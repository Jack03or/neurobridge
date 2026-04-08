package com.example.demo.service;

import com.example.demo.model.Child;
import com.example.demo.model.FitBitMetrics;
import com.example.demo.model.MedicationLog;
import com.example.demo.model.SeizureLog;
import com.example.demo.repository.FitBitMetricsRepository;
import com.example.demo.repository.MedicationLogRepository;
import com.example.demo.repository.SeizureLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class FakeFitbitService implements FitbitService {

    @Autowired
    private FitBitMetricsRepository metricsRepository;

    @Autowired
    private MedicationLogRepository medicationLogRepository;

    @Autowired
    private SeizureLogRepository seizureLogRepository;

    @Autowired
    private FitbitOAuthService fitbitOAuthService;

    // Python FastAPI base URL (local demo)
    private static final String PYTHON_BASE_URL = "http://127.0.0.1:8000";

    @Value("${fitbit.api-base:https://api.fitbit.com}")
    private String fitbitApiBase;

    private final RestTemplate restTemplate = new RestTemplate();

    @Override
    public FitBitMetrics getOrCreateTodayMetrics(Child child) {
        LocalDate today = LocalDate.now();

        List<FitBitMetrics> existingRows = metricsRepository.findByChildAndDateOrderByCreatedAtDescIdDesc(child, today);
        existingRows = collapseDuplicateDailyMetrics(existingRows);

        FitBitMetrics metrics;
        if (!existingRows.isEmpty()) {
            metrics = existingRows.get(0);
            if (fitbitOAuthService.hasConnection(child)) {
                boolean updated = tryPopulateFromFitbit(metrics, child);
                if (updated) {
                    metrics = metricsRepository.save(metrics);
                }
            }
        } else {
            metrics = new FitBitMetrics();
            metrics.setChild(child);
            metrics.setDate(today);

            boolean updated = false;
            if (fitbitOAuthService.hasConnection(child)) {
                updated = tryPopulateFromFitbit(metrics, child);
            }
            if (!updated) {
                applySimulatedMetrics(metrics);
            }

            metrics = metricsRepository.save(metrics);
        }

        // calculate/store risk once per day
        if (metrics.getRiskCalculatedAt() == null) {
            applyDailyRiskFromPython(metrics, child);
            metrics = metricsRepository.save(metrics);
        }

        return metrics;
    }

    @Override
    public FitBitMetrics saveMetrics(FitBitMetrics metrics) {
        return metricsRepository.save(metrics);
    }

    @Override
    public FitBitMetrics refreshTodayRisk(Child child) {
        FitBitMetrics metrics = getOrCreateTodayMetrics(child);
        applyDailyRiskFromPython(metrics, child);
        return metricsRepository.save(metrics);
    }

    private List<FitBitMetrics> collapseDuplicateDailyMetrics(List<FitBitMetrics> rows) {
        if (rows == null || rows.size() <= 1) {
            return rows == null ? List.of() : rows;
        }

        FitBitMetrics keeper = rows.get(0);
        List<FitBitMetrics> duplicates = rows.subList(1, rows.size());
        metricsRepository.deleteAll(duplicates);
        return List.of(keeper);
    }

    private void applyDailyRiskFromPython(FitBitMetrics metrics, Child child) {
        try {
            LocalDate today = LocalDate.now();
            List<MedicationLog> todayLogs = medicationLogRepository.findByChildAndDate(child, today);
            int medicationTaken = todayLogs.stream().anyMatch(MedicationLog::isTaken) ? 1 : 0;

            Optional<SeizureLog> latest = seizureLogRepository.findFirstByChildOrderByTimestampDesc(child);
            int daysSinceSeizure = 30;
            if (latest.isPresent() && latest.get().getTimestamp() != null) {
                long days = ChronoUnit.DAYS.between(latest.get().getTimestamp().toLocalDate(), today);
                daysSinceSeizure = (int) Math.max(days, 0);
            }

            Map<String, Object> payload = Map.of(
                    "sleep_hours", metrics.getSleepHours() == null ? 7.5 : metrics.getSleepHours(),
                    "latest_heart_rate", metrics.getLatestHeartRate() == null ? 85 : metrics.getLatestHeartRate(),
                    "hrv", metrics.getHrv() == null ? 55.0 : metrics.getHrv(),
                    "medication_taken", medicationTaken,
                    "days_since_seizure", daysSinceSeizure
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);

            ResponseEntity<Map> response = restTemplate.exchange(
                    PYTHON_BASE_URL + "/predict",
                    HttpMethod.POST,
                    request,
                    Map.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Object riskPercentObj = response.getBody().get("risk_percent");
                Object riskLevelObj = response.getBody().get("risk_level");

                Integer riskPercent = safeInt(riskPercentObj);
                String riskLevel = riskLevelObj == null ? "UNKNOWN" : riskLevelObj.toString();

                if (riskPercent != null) {
                    if (riskPercent < 1) riskPercent = 1;
                    if (riskPercent > 95) riskPercent = 95;
                }

                metrics.setRiskPercent(riskPercent);
                metrics.setRiskLevel(riskLevel);
                metrics.setRiskCalculatedAt(LocalDateTime.now());
                return;
            }

            applyFallbackHeuristic(metrics);

        } catch (Exception ex) {
            applyFallbackHeuristic(metrics);
        }
    }

    private void applyFallbackHeuristic(FitBitMetrics metrics) {
        int risk = 10;

        if (metrics.getSleepHours() != null && metrics.getSleepHours() < 7.0) risk += 20;
        if (metrics.getHrv() != null && metrics.getHrv() < 40.0) risk += 15;
        if (metrics.getLatestHeartRate() != null && metrics.getLatestHeartRate() > 100) risk += 10;

        if (risk < 1) risk = 1;
        if (risk > 80) risk = 80;

        String level;
        if (risk < 30) level = "LOW";
        else if (risk < 60) level = "MEDIUM";
        else level = "HIGH";

        metrics.setRiskPercent(risk);
        metrics.setRiskLevel(level);
        metrics.setRiskCalculatedAt(LocalDateTime.now());
    }

    private boolean tryPopulateFromFitbit(FitBitMetrics metrics, Child child) {
        try {
            LocalDate day = metrics.getDate() == null ? LocalDate.now() : metrics.getDate();
            String dayStr = day.format(DateTimeFormatter.ISO_DATE);

            Map<String, Object> sleepJson = getFitbitJson(child, "/1.2/user/-/sleep/date/" + dayStr + ".json");
            Map<String, Object> hrJson = getFitbitJson(child, "/1/user/-/activities/heart/date/" + dayStr + "/1d/1min.json");
            Map<String, Object> hrvJson = safeGetFitbitJson(child, "/1/user/-/hrv/date/" + dayStr + ".json");

            Double sleepHours = parseSleepHours(sleepJson);
            Integer latestHr = parseLatestHeartRate(hrJson);
            LocalDateTime latestHrAt = parseLatestHeartRateAt(hrJson, day);
            Double hrv = parseHrv(hrvJson);

            System.out.println("Fitbit heart raw for child " + child.getId() + ": " + hrJson);
            System.out.println("Fitbit heart parsed for child " + child.getId()
                    + ": rate=" + latestHr + ", at=" + latestHrAt);

            boolean hasAny = false;
            if (sleepHours != null) {
                metrics.setSleepHours(roundOneDecimal(sleepHours));
                hasAny = true;
            }
            if (latestHr != null) {
                metrics.setLatestHeartRate(latestHr);
                metrics.setLatestHeartRateAt(latestHrAt == null ? LocalDateTime.now() : latestHrAt);
                hasAny = true;
            }
            if (hrv != null) {
                metrics.setHrv(roundOneDecimal(hrv));
                hasAny = true;
            }

            if (hasAny) {
                fitbitOAuthService.markLastSyncNow(child);
            }

            return hasAny;
        } catch (Exception ex) {
            return false;
        }
    }

    private Map<String, Object> getFitbitJson(Child child, String path) {
        String token = fitbitOAuthService.getValidAccessToken(child);
        String url = UriComponentsBuilder.fromHttpUrl(fitbitApiBase + path).toUriString();
        try {
            return doGet(url, token);
        } catch (HttpClientErrorException.Unauthorized unauthorized) {
            String refreshed = fitbitOAuthService.refreshAccessTokenForChild(child);
            return doGet(url, refreshed);
        }
    }

    private Map<String, Object> safeGetFitbitJson(Child child, String path) {
        try {
            return getFitbitJson(child, path);
        } catch (Exception ex) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> doGet(String url, String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        HttpEntity<Void> request = new HttpEntity<>(headers);
        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, request, Map.class);
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new IllegalArgumentException("Fitbit GET failed: " + url);
        }
        return (Map<String, Object>) response.getBody();
    }

    private void applySimulatedMetrics(FitBitMetrics metrics) {
        double sleepHours = randomDouble(6.0, 9.0);
        metrics.setSleepHours(roundOneDecimal(sleepHours));

        int heartRate = randomInt(70, 110);
        metrics.setLatestHeartRate(heartRate);
        metrics.setLatestHeartRateAt(LocalDateTime.now().minusMinutes(1));

        double hrv = randomDouble(30.0, 80.0);
        metrics.setHrv(roundOneDecimal(hrv));
    }

    @SuppressWarnings("unchecked")
    private Double parseSleepHours(Map<String, Object> sleepJson) {
        if (sleepJson == null) return null;
        Object sleepObj = sleepJson.get("sleep");
        if (!(sleepObj instanceof List<?> sleepList) || sleepList.isEmpty()) return null;

        List<Double> minutes = new ArrayList<>();
        for (Object item : sleepList) {
            if (item instanceof Map<?, ?> map) {
                Object mins = map.get("minutesAsleep");
                if (mins instanceof Number n) {
                    minutes.add(n.doubleValue());
                }
            }
        }
        if (minutes.isEmpty()) return null;
        double avgMinutes = minutes.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
        return avgMinutes / 60.0;
    }

    @SuppressWarnings("unchecked")
    private Integer parseLatestHeartRate(Map<String, Object> hrJson) {
        if (hrJson == null) return null;
        Object activitiesObj = hrJson.get("activities-heart-intraday");
        if (activitiesObj instanceof Map<?, ?> intradayMap) {
            Object datasetObj = intradayMap.get("dataset");
            if (datasetObj instanceof List<?> dataset && !dataset.isEmpty()) {
                Object last = dataset.get(dataset.size() - 1);
                if (last instanceof Map<?, ?> point) {
                    Object value = point.get("value");
                    if (value instanceof Number n) {
                        return n.intValue();
                    }
                }
            }
        }

        Object activitiesDayObj = hrJson.get("activities-heart");
        if (activitiesDayObj instanceof List<?> dayList && !dayList.isEmpty()) {
            Object first = dayList.get(0);
            if (first instanceof Map<?, ?> firstMap) {
                Object valueObj = firstMap.get("value");
                if (valueObj instanceof Map<?, ?> valueMap) {
                    Object resting = valueMap.get("restingHeartRate");
                    if (resting instanceof Number n) {
                        return n.intValue();
                    }
                }
            }
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private LocalDateTime parseLatestHeartRateAt(Map<String, Object> hrJson, LocalDate date) {
        if (hrJson == null) return null;
        Object activitiesObj = hrJson.get("activities-heart-intraday");
        if (!(activitiesObj instanceof Map<?, ?> intradayMap)) return null;
        Object datasetObj = intradayMap.get("dataset");
        if (!(datasetObj instanceof List<?> dataset) || dataset.isEmpty()) return null;

        Object last = dataset.get(dataset.size() - 1);
        if (!(last instanceof Map<?, ?> point)) return null;
        Object timeObj = point.get("time");
        if (!(timeObj instanceof String t) || t.isBlank()) return null;

        try {
            return LocalDateTime.parse(date + "T" + t);
        } catch (Exception ex) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private Double parseHrv(Map<String, Object> hrvJson) {
        if (hrvJson == null) return null;
        Object hrvObj = hrvJson.get("hrv");
        if (!(hrvObj instanceof List<?> hrvList) || hrvList.isEmpty()) return null;

        List<Double> values = new ArrayList<>();
        for (Object item : hrvList) {
            if (!(item instanceof Map<?, ?> map)) continue;
            Object valueObj = map.get("value");
            if (valueObj instanceof Map<?, ?> valueMap) {
                Object rmssd = valueMap.get("dailyRmssd");
                if (rmssd instanceof Number n) {
                    values.add(n.doubleValue());
                }
            }
        }
        if (values.isEmpty()) return null;
        return values.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
    }

    private Integer safeInt(Object value) {
        if (value == null) return null;
        if (value instanceof Integer i) return i;
        if (value instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(value.toString());
        } catch (Exception e) {
            return null;
        }
    }

    private double randomDouble(double min, double max) {
        return ThreadLocalRandom.current().nextDouble(min, max);
    }

    private int randomInt(int min, int max) {
        return ThreadLocalRandom.current().nextInt(min, max + 1);
    }

    private double roundOneDecimal(double value) {
        return Math.round(value * 10.0) / 10.0;
    }
}


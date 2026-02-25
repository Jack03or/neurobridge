package com.example.demo.service;

import com.example.demo.model.Child;
import com.example.demo.model.FitBitMetrics;
import com.example.demo.model.MedicationLog;
import com.example.demo.model.SeizureLog;
import com.example.demo.repository.FitBitMetricsRepository;
import com.example.demo.repository.MedicationLogRepository;
import com.example.demo.repository.SeizureLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
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

    // Python FastAPI base URL (local demo)
    private static final String PYTHON_BASE_URL = "http://127.0.0.1:8000";

    private final RestTemplate restTemplate = new RestTemplate();

    @Override
    public FitBitMetrics getOrCreateTodayMetrics(Child child) {
        LocalDate today = LocalDate.now();

        Optional<FitBitMetrics> existing = metricsRepository.findByChildAndDate(child, today);

        FitBitMetrics metrics;
        if (existing.isPresent()) {
            metrics = existing.get();
        } else {
            metrics = new FitBitMetrics();
            metrics.setChild(child);
            metrics.setDate(today);

            double sleepHours = randomDouble(6.0, 9.0);
            metrics.setSleepHours(roundOneDecimal(sleepHours));

            int heartRate = randomInt(70, 110);
            metrics.setLatestHeartRate(heartRate);
            metrics.setLatestHeartRateAt(LocalDateTime.now().minusMinutes(1));

            double hrv = randomDouble(30.0, 80.0);
            metrics.setHrv(roundOneDecimal(hrv));

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


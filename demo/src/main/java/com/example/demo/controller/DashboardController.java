package com.example.demo.controller;

import com.example.demo.model.Child;
import com.example.demo.model.FitBitMetrics;
import com.example.demo.model.MedicationLog;
import com.example.demo.model.SeizureLog;
import com.example.demo.model.User;
import com.example.demo.repository.ChildRepository;
import com.example.demo.repository.MedicationLogRepository;
import com.example.demo.repository.SeizureLogRepository;
import com.example.demo.repository.UserRepository;
import com.example.demo.service.FitbitService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/dashboard")
@CrossOrigin(origins = "*")
public class DashboardController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ChildRepository childRepository;

    @Autowired
    private FitbitService fitbitService;

    @Autowired
    private SeizureLogRepository seizureLogRepository;

    @Autowired
    private MedicationLogRepository medicationLogRepository;

    @Value("${ml.base-url:http://127.0.0.1:8000}")
    private String mlBaseUrl;

    @GetMapping("/by-user/{userId}")
    public ResponseEntity<?> getDashboardForUser(@PathVariable Long userId) {
        return buildDashboardForUser(userId, false);
    }

    @PostMapping("/refresh-risk/by-user/{userId}")
    public ResponseEntity<?> refreshRiskForUser(@PathVariable Long userId) {
        return buildDashboardForUser(userId, true);
    }

    @GetMapping("/insights/by-user/{userId}")
    public ResponseEntity<?> getInsightsForUser(@PathVariable Long userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }

        Child child = childRepository.findByUserId(userId).orElse(null);
        if (child == null) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("insights", List.of("Not enough data yet to show smart insights."));
            return ResponseEntity.ok(response);
        }

        List<String> insights = fetchMlInsights(child.getId());
        if (insights.isEmpty()) {
            insights = List.of("Not enough data yet to show smart insights.");
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("insights", insights);
        response.put("charts", buildChartData(child));
        return ResponseEntity.ok(response);
    }

    private ResponseEntity<?> buildDashboardForUser(Long userId, boolean forceRefreshRisk) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }

        Child child = childRepository.findByUserId(userId).orElse(null);
        if (child == null) {
            DashboardResponse response = new DashboardResponse();
            response.setHasChild(false);
            response.setMessage("No child linked to this user yet.");

            // keep defaults consistent
            response.setLastSeizureText("--");
            response.setMedicationTakenToday(false);
            response.setMedicationStatusText("Not logged");

            return ResponseEntity.ok(response);
        }

        DashboardResponse response = new DashboardResponse();
        response.setHasChild(true);
        response.setMessage("OK");

        response.setChildId(child.getId());
        response.setChildName(child.getName());
        response.setGender(child.getGender());
        response.setDisability(child.getDisability());
        response.setDob(child.getDob());

        FitBitMetrics metrics = forceRefreshRisk
                ? fitbitService.refreshTodayRisk(child)
                : fitbitService.getOrCreateTodayMetrics(child);

        if (metrics != null) {
            response.setSleepHours(metrics.getSleepHours());
            response.setHeartRate(metrics.getLatestHeartRate());
            response.setHeartRateAgeMinutes(metrics.getLatestHeartRate() == null ? null : 1);
            response.setHrv(metrics.getHrv());
            response.setFitbitStatusText("Simulated");

            response.setRiskPercent(metrics.getRiskPercent());
            response.setRiskLevel(metrics.getRiskLevel() == null ? "UNKNOWN" : metrics.getRiskLevel());
        } else {
            response.setFitbitStatusText("--");
            response.setRiskPercent(null);
            response.setRiskLevel("UNKNOWN");
        }

        //last seizure + medication status replaces place holders i had
        applySeizureAndMedicationStatus(child, response);

        return ResponseEntity.ok(response);
    }

    // To populate siezure and med status
    private void applySeizureAndMedicationStatus(Child child, DashboardResponse response) {
        LocalDate today = LocalDate.now();

        // ---- MEDICATION (today) ----
        List<MedicationLog> todayLogs = medicationLogRepository.findByChildAndDate(child, today);

        boolean anyLogged = !todayLogs.isEmpty();
        boolean anyTaken = todayLogs.stream().anyMatch(MedicationLog::isTaken);

        response.setMedicationTakenToday(anyTaken);

        if (anyTaken) {
            response.setMedicationStatusText("Taken today");
        } else if (anyLogged) {
            response.setMedicationStatusText("Missed today");
        } else {
            response.setMedicationStatusText("Not logged");
        }

        // ---- LAST SEIZURE (days ago) ----
        Optional<SeizureLog> latest = seizureLogRepository.findFirstByChildOrderByTimestampDesc(child);

        if (latest.isEmpty() || latest.get().getTimestamp() == null) {
            response.setLastSeizureText("--");
            return;
        }

        LocalDateTime ts = latest.get().getTimestamp();
        long daysAgo = ChronoUnit.DAYS.between(ts.toLocalDate(), today);

        if (daysAgo <= 0) {
            response.setLastSeizureText("Today");
        } else if (daysAgo == 1) {
            response.setLastSeizureText("1 day ago");
        } else {
            response.setLastSeizureText(daysAgo + " days ago");
        }
    }

    private List<String> fetchMlInsights(Long childId) {
        try {
            RestTemplate restTemplate = new RestTemplate();
            String url = UriComponentsBuilder.fromHttpUrl(mlBaseUrl + "/insights")
                    .queryParam("childId", childId)
                    .toUriString();
            Map response = restTemplate.getForObject(url, Map.class);
            if (response == null || !response.containsKey("insights")) {
                return List.of();
            }
            Object raw = response.get("insights");
            if (raw instanceof List<?> list) {
                List<String> out = new ArrayList<>();
                for (Object item : list) {
                    out.add(String.valueOf(item));
                }
                return out;
            }
        } catch (Exception ignored) {
        }
        return List.of();
    }

    private Map<String, Object> buildChartData(Child child) {
        Map<String, Object> charts = new LinkedHashMap<>();

        LocalDate today = LocalDate.now();
        LocalDate trendStart = today.minusDays(6);

        List<String> trendLabels = new ArrayList<>();
        List<Integer> trendValues = new ArrayList<>();

        LocalDateTime seizureWindowStart = trendStart.atStartOfDay();
        List<SeizureLog> recentSeizures = seizureLogRepository.findByChildAndTimestampBetween(
                child, seizureWindowStart, LocalDateTime.now()
        );

        Map<LocalDate, Long> trendByDate = recentSeizures.stream()
                .filter(s -> s.getTimestamp() != null)
                .collect(Collectors.groupingBy(s -> s.getTimestamp().toLocalDate(), Collectors.counting()));

        for (int i = 0; i < 7; i++) {
            LocalDate day = trendStart.plusDays(i);
            trendLabels.add(day.getDayOfWeek().name().substring(0, 3));
            trendValues.add(trendByDate.getOrDefault(day, 0L).intValue());
        }

        Map<String, Object> trendSeries = new LinkedHashMap<>();
        trendSeries.put("labels", trendLabels);
        trendSeries.put("values", trendValues);
        charts.put("trendSeries", trendSeries);

        List<SeizureLog> allSeizures = seizureLogRepository.findByChildOrderByTimestampDesc(child);
        Map<String, Integer> timingBuckets = new LinkedHashMap<>();
        timingBuckets.put("Morning", 0);
        timingBuckets.put("Afternoon", 0);
        timingBuckets.put("Evening", 0);
        timingBuckets.put("Night", 0);

        for (SeizureLog seizure : allSeizures) {
            if (seizure.getTimestamp() == null) continue;
            int hour = seizure.getTimestamp().getHour();
            if (hour <= 5) timingBuckets.computeIfPresent("Night", (k, v) -> v + 1);
            else if (hour <= 11) timingBuckets.computeIfPresent("Morning", (k, v) -> v + 1);
            else if (hour <= 17) timingBuckets.computeIfPresent("Afternoon", (k, v) -> v + 1);
            else timingBuckets.computeIfPresent("Evening", (k, v) -> v + 1);
        }

        Map<String, Object> timingSplit = new LinkedHashMap<>();
        timingSplit.put("labels", new ArrayList<>(timingBuckets.keySet()));
        timingSplit.put("values", new ArrayList<>(timingBuckets.values()));
        charts.put("timingSplit", timingSplit);

        int taken = 0;
        int missed = 0;
        Map<LocalDate, List<MedicationLog>> medsByDate = medicationLogRepository
                .findByChildOrderByDateDesc(child)
                .stream()
                .collect(Collectors.groupingBy(MedicationLog::getDate, HashMap::new, Collectors.toList()));

        for (SeizureLog seizure : allSeizures) {
            if (seizure.getTimestamp() == null) continue;
            LocalDate day = seizure.getTimestamp().toLocalDate();
            List<MedicationLog> dayLogs = medsByDate.getOrDefault(day, List.of());

            boolean anyTaken = dayLogs.stream().anyMatch(MedicationLog::isTaken);
            boolean anyMissed = dayLogs.stream().anyMatch(m -> !m.isTaken());

            if (anyTaken) taken++;
            else if (anyMissed) missed++;
        }

        Map<String, Object> medicationSplit = new LinkedHashMap<>();
        medicationSplit.put("labels", Arrays.asList("Taken", "Missed"));
        medicationSplit.put("values", Arrays.asList(taken, missed));
        charts.put("medicationSplit", medicationSplit);

        return charts;
    }

    // DTO for dashboard response
    public static class DashboardResponse {

        private boolean hasChild;
        private String message;

        private Long childId;
        private String childName;
        private String gender;
        private String disability;
        private LocalDate dob;

        private String lastSeizureText;
        private boolean medicationTakenToday;
        private String medicationStatusText;
        private String fitbitStatusText;

        private Double sleepHours;
        private Integer heartRate;
        private Integer heartRateAgeMinutes;
        private Double hrv;

        private Integer riskPercent;
        private String riskLevel;

        public boolean isHasChild() { return hasChild; }
        public void setHasChild(boolean hasChild) { this.hasChild = hasChild; }

        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }

        public Long getChildId() { return childId; }
        public void setChildId(Long childId) { this.childId = childId; }

        public String getChildName() { return childName; }
        public void setChildName(String childName) { this.childName = childName; }

        public String getGender() { return gender; }
        public void setGender(String gender) { this.gender = gender; }

        public String getDisability() { return disability; }
        public void setDisability(String disability) { this.disability = disability; }

        public LocalDate getDob() { return dob; }
        public void setDob(LocalDate dob) { this.dob = dob; }

        public String getLastSeizureText() { return lastSeizureText; }
        public void setLastSeizureText(String lastSeizureText) { this.lastSeizureText = lastSeizureText; }

        public boolean isMedicationTakenToday() { return medicationTakenToday; }
        public void setMedicationTakenToday(boolean medicationTakenToday) { this.medicationTakenToday = medicationTakenToday; }

        public String getMedicationStatusText() { return medicationStatusText; }
        public void setMedicationStatusText(String medicationStatusText) { this.medicationStatusText = medicationStatusText; }

        public String getFitbitStatusText() { return fitbitStatusText; }
        public void setFitbitStatusText(String fitbitStatusText) { this.fitbitStatusText = fitbitStatusText; }

        public Double getSleepHours() { return sleepHours; }
        public void setSleepHours(Double sleepHours) { this.sleepHours = sleepHours; }

        public Integer getHeartRate() { return heartRate; }
        public void setHeartRate(Integer heartRate) { this.heartRate = heartRate; }

        public Integer getHeartRateAgeMinutes() { return heartRateAgeMinutes; }
        public void setHeartRateAgeMinutes(Integer heartRateAgeMinutes) { this.heartRateAgeMinutes = heartRateAgeMinutes; }

        public Double getHrv() { return hrv; }
        public void setHrv(Double hrv) { this.hrv = hrv; }

        public Integer getRiskPercent() { return riskPercent; }
        public void setRiskPercent(Integer riskPercent) { this.riskPercent = riskPercent; }

        public String getRiskLevel() { return riskLevel; }
        public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }
    }
}

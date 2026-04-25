package com.example.demo.controller;

import com.example.demo.model.Child;
import com.example.demo.model.FitBitMetrics;
import com.example.demo.model.MedicationLog;
import com.example.demo.model.MedicationSchedule;
import com.example.demo.model.SeizureLog;
import com.example.demo.model.User;
import com.example.demo.repository.ChildRepository;
import com.example.demo.repository.FitBitMetricsRepository;
import com.example.demo.repository.MedicationLogRepository;
import com.example.demo.repository.MedicationScheduleRepository;
import com.example.demo.repository.SeizureLogRepository;
import com.example.demo.repository.UserRepository;
import com.example.demo.service.FitbitOAuthService;
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
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.time.format.DateTimeFormatter;
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

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("h:mm a");

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ChildRepository childRepository;

    @Autowired
    private FitbitService fitbitService;

    @Autowired
    private FitBitMetricsRepository fitBitMetricsRepository;

    @Autowired
    private SeizureLogRepository seizureLogRepository;

    @Autowired
    private MedicationLogRepository medicationLogRepository;

    @Autowired
    private MedicationScheduleRepository medicationScheduleRepository;

    @Autowired
    private FitbitOAuthService fitbitOAuthService;

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

    @PostMapping("/refresh-insights/by-user/{userId}")
    public ResponseEntity<?> refreshInsightsForUser(@PathVariable Long userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }

        Child child = resolveChild(userId);
        if (child == null) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("insights", List.of("Not enough data yet to show smart insights."));
            response.put("categories", Map.of());
            response.put("charts", Map.of());
            return ResponseEntity.ok(response);
        }

        Map<String, Object> mlInsights = refreshMlInsights(child.getId());
        Object rawInsights = mlInsights.get("insights");
        List<String> insights = toStringList(rawInsights);
        if (insights.isEmpty()) {
            insights = List.of("Not enough data yet to show smart insights.");
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("insights", insights);
        response.put("categories", mlInsights.getOrDefault("categories", Map.of()));
        response.put("charts", buildChartData(child));
        return ResponseEntity.ok(response);
    }

    @GetMapping("/insights/by-user/{userId}")
    public ResponseEntity<?> getInsightsForUser(@PathVariable Long userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }

        Child child = resolveChild(userId);
        if (child == null) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("insights", List.of("Not enough data yet to show smart insights."));
            return ResponseEntity.ok(response);
        }

        Map<String, Object> mlInsights = fetchMlInsights(child.getId());
        Object rawInsights = mlInsights.get("insights");
        List<String> insights = toStringList(rawInsights);
        if (insights.isEmpty()) {
            insights = List.of("Not enough data yet to show smart insights.");
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("insights", insights);
        response.put("categories", mlInsights.getOrDefault("categories", Map.of()));
        response.put("charts", buildChartData(child));
        return ResponseEntity.ok(response);
    }

    private ResponseEntity<?> buildDashboardForUser(Long userId, boolean forceRefreshRisk) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }

        Child child = resolveChild(userId);
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
        applyMedicationSchedule(child, response);

        FitBitMetrics metrics = forceRefreshRisk
                ? fitbitService.refreshTodayRisk(child)
                : fitbitService.getOrCreateTodayMetrics(child);

        if (metrics != null) {
            response.setSleepHours(metrics.getSleepHours());
            response.setHeartRate(metrics.getLatestHeartRate());
            response.setHeartRateAgeMinutes(metrics.getLatestHeartRate() == null ? null : 1);
            response.setHrv(metrics.getHrv());
            response.setFitbitStatusText(fitbitOAuthService.hasConnection(child) ? "Connected" : "Simulated");

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

    private Child resolveChild(Long userId) {
        if (userId == null) {
            return null;
        }

        return childRepository.findAllByUserIdOrderByCreatedAtDescIdDesc(userId).stream()
                .findFirst()
                .orElse(null);
    }

    // To populate siezure and med status
    private void applySeizureAndMedicationStatus(Child child, DashboardResponse response) {
        LocalDate today = LocalDate.now();

        // ---- MEDICATION (today) ----
        List<MedicationLog> todayLogs = medicationLogRepository.findByChildAndDate(child, today);

        boolean anyTaken = todayLogs.stream().anyMatch(MedicationLog::isTaken);

        response.setMedicationTakenToday(anyTaken);

        if (anyTaken) {
            response.setMedicationStatusText("Taken today");
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

    private void applyMedicationSchedule(Child child, DashboardResponse response) {
        List<MedicationSchedule> schedules = medicationScheduleRepository.findByChildAndActiveTrueOrderByCreatedAtAsc(child);
        if (schedules.isEmpty()) {
            response.setScheduledMedicationTime(null);
            return;
        }

        LocalTime defaultTime = schedules.get(0).getDefaultTime();
        response.setScheduledMedicationTime(defaultTime == null ? null : defaultTime.format(TIME_FORMATTER));
    }

    private Map<String, Object> fetchMlInsights(Long childId) {
        try {
            RestTemplate restTemplate = new RestTemplate();
            String url = UriComponentsBuilder.fromHttpUrl(mlBaseUrl + "/insights")
                    .queryParam("childId", childId)
                    .toUriString();
            Map response = restTemplate.getForObject(url, Map.class);
            if (response != null) {
                return response;
            }
        } catch (Exception ignored) {
        }
        return Map.of();
    }

    private Map<String, Object> refreshMlInsights(Long childId) {
        try {
            RestTemplate restTemplate = new RestTemplate();
            String url = UriComponentsBuilder.fromHttpUrl(mlBaseUrl + "/refresh-insights")
                    .queryParam("childId", childId)
                    .toUriString();
            Map response = restTemplate.postForObject(url, null, Map.class);
            if (response != null) {
                return response;
            }
        } catch (Exception ignored) {
        }
        return fetchMlInsights(childId);
    }

    private List<String> toStringList(Object raw) {
        if (!(raw instanceof List<?> list)) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (Object item : list) {
            out.add(String.valueOf(item));
        }
        return out;
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
        charts.put("dailyDetails", buildDailyDetails(child, trendStart, today, recentSeizures, trendByDate));

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
        charts.put("sleepSeizureSeries", buildSleepSeizureSeries(child, trendStart, today, trendByDate));

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

        charts.put("medicationHeatmap", buildMedicationHeatmap(child));

        return charts;
    }

    private List<Map<String, Object>> buildDailyDetails(
            Child child,
            LocalDate start,
            LocalDate end,
            List<SeizureLog> recentSeizures,
            Map<LocalDate, Long> trendByDate
    ) {
        Map<LocalDate, List<SeizureLog>> seizuresByDate = recentSeizures.stream()
                .filter(seizure -> seizure.getTimestamp() != null)
                .collect(Collectors.groupingBy(
                        seizure -> seizure.getTimestamp().toLocalDate(),
                        HashMap::new,
                        Collectors.toList()
                ));

        Map<LocalDate, FitBitMetrics> metricsByDate = fitBitMetricsRepository
                .findByChildAndDateBetweenOrderByDateAsc(child, start, end)
                .stream()
                .collect(Collectors.toMap(FitBitMetrics::getDate, m -> m, (first, second) -> second, LinkedHashMap::new));

        Map<LocalDate, List<MedicationLog>> medsByDate = medicationLogRepository
                .findByChildAndDateBetweenOrderByDateDesc(child, start, end)
                .stream()
                .collect(Collectors.groupingBy(MedicationLog::getDate, HashMap::new, Collectors.toList()));

        List<MedicationSchedule> schedules = medicationScheduleRepository.findByChildAndActiveTrueOrderByCreatedAtAsc(child);
        LocalTime scheduledTime = schedules.isEmpty() ? null : schedules.get(0).getDefaultTime();

        List<Map<String, Object>> details = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            LocalDate day = start.plusDays(i);
            List<SeizureLog> daySeizures = seizuresByDate.getOrDefault(day, List.of());
            FitBitMetrics metric = metricsByDate.get(day);
            List<MedicationLog> dayMeds = medsByDate.getOrDefault(day, List.of());
            String medicationStatus = resolveMedicationDayStatus(dayMeds, scheduledTime);
            List<String> triggers = buildTriggerList(daySeizures);

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("date", day.toString());
            item.put("label", day.getDayOfWeek().name().substring(0, 3));
            item.put("seizureCount", trendByDate.getOrDefault(day, 0L).intValue());
            item.put("seizureTimes", buildSeizureTimes(daySeizures));
            item.put("sleepHours", metric == null ? null : metric.getSleepHours());
            item.put("heartRate", metric == null ? null : metric.getLatestHeartRate());
            item.put("hrv", metric == null ? null : metric.getHrv());
            item.put("medicationStatus", medicationStatus);
            item.put("medicationStatusText", medicationStatusText(medicationStatus));
            item.put("triggers", triggers);
            item.put("hoursSinceLastMeal", latestHoursSinceLastMeal(daySeizures));
            item.put("summary", buildDailyDetailSummary(
                    trendByDate.getOrDefault(day, 0L).intValue(),
                    metric,
                    medicationStatus,
                    triggers
            ));
            details.add(item);
        }
        return details;
    }

    private List<String> buildSeizureTimes(List<SeizureLog> seizures) {
        return seizures.stream()
                .filter(seizure -> seizure.getTimestamp() != null)
                .map(seizure -> seizure.getTimestamp().toLocalTime().format(TIME_FORMATTER))
                .collect(Collectors.toList());
    }

    private List<String> buildTriggerList(List<SeizureLog> seizures) {
        List<String> triggers = new ArrayList<>();
        for (SeizureLog seizure : seizures) {
            if (seizure.getSeizureTrigger() == null || seizure.getSeizureTrigger().isBlank()) {
                continue;
            }
            for (String trigger : seizure.getSeizureTrigger().split(",")) {
                String cleaned = trigger.trim();
                if (!cleaned.isBlank() && !triggers.contains(cleaned)) {
                    triggers.add(cleaned);
                }
            }
        }
        return triggers;
    }

    private Integer latestHoursSinceLastMeal(List<SeizureLog> seizures) {
        return seizures.stream()
                .filter(seizure -> seizure.getTimestamp() != null)
                .filter(seizure -> seizure.getHoursSinceLastMeal() != null)
                .max((a, b) -> a.getTimestamp().compareTo(b.getTimestamp()))
                .map(SeizureLog::getHoursSinceLastMeal)
                .orElse(null);
    }

    private String medicationStatusText(String status) {
        return switch (status) {
            case "taken" -> "Medication taken on time";
            case "late" -> "Medication taken late";
            case "missed" -> "Medication missed";
            default -> "Medication not logged";
        };
    }

    private String buildDailyDetailSummary(
            int seizureCount,
            FitBitMetrics metric,
            String medicationStatus,
            List<String> triggers
    ) {
        List<String> factors = new ArrayList<>();

        if (metric != null && metric.getSleepHours() != null && metric.getSleepHours() < 6.0) {
            factors.add("low sleep");
        }
        if ("late".equals(medicationStatus)) {
            factors.add("late medication");
        } else if ("missed".equals(medicationStatus)) {
            factors.add("missed medication");
        }
        if (metric != null && metric.getLatestHeartRate() != null && metric.getLatestHeartRate() > 100) {
            factors.add("higher heart rate");
        }
        if (metric != null && metric.getHrv() != null && metric.getHrv() < 40.0) {
            factors.add("lower HRV");
        }
        if (!triggers.isEmpty()) {
            factors.add("noted triggers");
        }

        if (seizureCount > 0 && !factors.isEmpty()) {
            return "This seizure day also had " + String.join(", ", factors) + ".";
        }
        if (seizureCount > 0) {
            return "A seizure was logged on this day.";
        }
        if (!factors.isEmpty()) {
            return "No seizure was logged, but this day had " + String.join(", ", factors) + ".";
        }
        return "No major warning signs stood out in the logged data.";
    }

    private Map<String, Object> buildSleepSeizureSeries(Child child, LocalDate start, LocalDate end, Map<LocalDate, Long> trendByDate) {
        Map<String, Object> series = new LinkedHashMap<>();
        List<FitBitMetrics> metrics = fitBitMetricsRepository.findByChildAndDateBetweenOrderByDateAsc(child, start, end);
        Map<LocalDate, FitBitMetrics> metricsByDate = metrics.stream()
                .collect(Collectors.toMap(FitBitMetrics::getDate, m -> m, (first, second) -> second, LinkedHashMap::new));

        List<String> labels = new ArrayList<>();
        List<Double> sleepValues = new ArrayList<>();
        List<Double> seizureMarkers = new ArrayList<>();
        List<Integer> seizureCounts = new ArrayList<>();

        for (int i = 0; i < 7; i++) {
            LocalDate day = start.plusDays(i);
            FitBitMetrics metric = metricsByDate.get(day);
            double sleepHours = metric != null && metric.getSleepHours() != null ? metric.getSleepHours() : 0.0;
            int seizureCount = trendByDate.getOrDefault(day, 0L).intValue();

            labels.add(day.getDayOfWeek().name().substring(0, 3));
            sleepValues.add(sleepHours);
            seizureMarkers.add(seizureCount > 0 ? sleepHours : null);
            seizureCounts.add(seizureCount);
        }

        series.put("labels", labels);
        series.put("sleepValues", sleepValues);
        series.put("seizureMarkers", seizureMarkers);
        series.put("seizureCounts", seizureCounts);
        return series;
    }

    private Map<String, Object> buildMedicationHeatmap(Child child) {
        Map<String, Object> heatmap = new LinkedHashMap<>();
        List<Map<String, Object>> days = new ArrayList<>();

        LocalDate today = LocalDate.now();
        LocalDate start = today.minusDays(9);

        List<MedicationSchedule> schedules = medicationScheduleRepository.findByChildAndActiveTrueOrderByCreatedAtAsc(child);
        LocalTime scheduledTime = schedules.isEmpty() ? null : schedules.get(0).getDefaultTime();

        Map<LocalDate, List<MedicationLog>> logsByDate = medicationLogRepository
                .findByChildAndDateBetweenOrderByDateDesc(child, start, today)
                .stream()
                .collect(Collectors.groupingBy(MedicationLog::getDate, HashMap::new, Collectors.toList()));

        int takenStreak = 0;
        int recentMissed = 0;
        int recentLate = 0;

        for (int i = 0; i < 10; i++) {
            LocalDate day = start.plusDays(i);
            List<MedicationLog> dayLogs = logsByDate.getOrDefault(day, List.of());
            String status = resolveMedicationDayStatus(dayLogs, scheduledTime);

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("date", day.toString());
            item.put("label", day.getDayOfWeek().name().substring(0, 3));
            item.put("day", day.getDayOfMonth());
            item.put("status", status);
            days.add(item);

            if ("missed".equals(status)) {
                recentMissed++;
            } else if ("late".equals(status)) {
                recentLate++;
            }
        }

        for (int i = days.size() - 1; i >= 0; i--) {
            String status = String.valueOf(days.get(i).get("status"));
            if ("taken".equals(status)) {
                takenStreak++;
            } else {
                break;
            }
        }

        heatmap.put("days", days);
        heatmap.put("summary", buildMedicationHeatmapSummary(days, takenStreak, recentMissed, recentLate));
        return heatmap;
    }

    private String resolveMedicationDayStatus(List<MedicationLog> dayLogs, LocalTime scheduledTime) {
        if (dayLogs == null || dayLogs.isEmpty()) {
            return "none";
        }

        boolean anyTaken = dayLogs.stream().anyMatch(MedicationLog::isTaken);
        boolean anyMissed = dayLogs.stream().anyMatch(log -> !log.isTaken());

        if (!anyTaken) {
            return anyMissed ? "missed" : "none";
        }

        if (scheduledTime == null) {
            return "taken";
        }

        boolean anyLate = dayLogs.stream()
                .filter(MedicationLog::isTaken)
                .map(MedicationLog::getTakenAt)
                .filter(time -> time != null)
                .anyMatch(time -> time.toLocalTime().isAfter(scheduledTime.plusMinutes(30)));

        return anyLate ? "late" : "taken";
    }

    private String buildMedicationHeatmapSummary(List<Map<String, Object>> days, int takenStreak, int recentMissed, int recentLate) {
        if (days.isEmpty()) {
            return "Not enough medication data yet.";
        }

        String latestStatus = String.valueOf(days.get(days.size() - 1).get("status"));

        if ("missed".equals(latestStatus)) {
            return "Medication was missed today. Try to get back on track today.";
        }

        if ("late".equals(latestStatus)) {
            return "Medication was late today. Try to keep close to the usual time.";
        }

        if (takenStreak >= 3) {
            return "On a " + takenStreak + " day medication streak. Keep it up.";
        }

        if (recentMissed >= 2) {
            return "Medication has been missed a few times recently.";
        }

        if (recentLate >= 2) {
            return "Medication has been late a few times recently.";
        }

        if ("taken".equals(latestStatus)) {
            return "Medication has been on track recently.";
        }

        return "Not enough medication data yet.";
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
        private String scheduledMedicationTime;
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

        public String getScheduledMedicationTime() { return scheduledMedicationTime; }
        public void setScheduledMedicationTime(String scheduledMedicationTime) { this.scheduledMedicationTime = scheduledMedicationTime; }

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

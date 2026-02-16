package com.example.demo.service;

import com.example.demo.model.*;
import com.example.demo.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.springframework.web.client.RestTemplate;

import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.*;
import java.util.stream.Collectors;

import javax.imageio.ImageIO;

@Service
public class ReportService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("d MMM yyyy");
    private static final DateTimeFormatter DATE_TIME_FMT = DateTimeFormatter.ofPattern("d MMM yyyy HH:mm");

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ChildRepository childRepository;

    @Autowired
    private SeizureLogRepository seizureLogRepository;

    @Autowired
    private MedicationLogRepository medicationLogRepository;

    @Autowired
    private FitBitMetricsRepository fitBitMetricsRepository;

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private TemplateEngine templateEngine;

    @Autowired
    private ObjectMapper objectMapper;

    @Value("${reports.storage.path:reports}")
    private String reportsStoragePath;

    @Value("${ml.base-url:http://127.0.0.1:8000}")
    private String mlBaseUrl;

    public Report generateReportForUser(Long userId, LocalDate startDate, LocalDate endDate, String titleInput) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            throw new IllegalArgumentException("User not found");
        }

        Child child = childRepository.findByUserId(userId).orElse(null);
        if (child == null) {
            throw new IllegalArgumentException("No child linked to this user");
        }

        if (startDate == null || endDate == null || endDate.isBefore(startDate)) {
            throw new IllegalArgumentException("Invalid date range");
        }

        String timeframe = formatTimeframe(startDate, endDate);
        String title = buildTitle(timeframe, titleInput);

        ReportData data = buildReportData(child, startDate, endDate, timeframe, title);

        Report report = new Report();
        report.setChild(child);
        report.setTitle(title);
        report.setStartDate(startDate);
        report.setEndDate(endDate);
        report.setCreatedAt(LocalDateTime.now());

        try {
            report.setSummaryJson(objectMapper.writeValueAsString(data.summaryJson));
        } catch (Exception e) {
            report.setSummaryJson("{}");
        }

        report = reportRepository.save(report);

        String fileName = "report-" + report.getId() + ".pdf";
        Path outputDir = resolveStorageDir();
        Path pdfPath = outputDir.resolve(fileName);

        generatePdf(data, pdfPath);

        report.setFilePath(pdfPath.toString());
        report = reportRepository.save(report);

        return report;
    }

    public List<Report> getReportsForUser(Long userId) {
        Child child = childRepository.findByUserId(userId).orElse(null);
        if (child == null) {
            return List.of();
        }
        return reportRepository.findByChildOrderByCreatedAtDesc(child);
    }

    public Optional<Report> getReport(Long reportId) {
        return reportRepository.findById(reportId);
    }

    public ReportData getReportDataForReport(Report report) {
        return buildReportData(report.getChild(), report.getStartDate(), report.getEndDate(),
                formatTimeframe(report.getStartDate(), report.getEndDate()), report.getTitle());
    }

    private ReportData buildReportData(Child child, LocalDate startDate, LocalDate endDate, String timeframe, String title) {
        LocalDateTime start = startDate.atStartOfDay();
        LocalDateTime end = endDate.atTime(LocalTime.MAX);

        List<SeizureLog> seizures = seizureLogRepository.findByChildAndTimestampBetween(child, start, end);
        seizures.sort(Comparator.comparing(SeizureLog::getTimestamp).reversed());

        List<MedicationLog> meds = medicationLogRepository.findByChildAndDateBetweenOrderByDateDesc(child, startDate, endDate);
        List<FitBitMetrics> metrics = fitBitMetricsRepository.findByChildAndDateBetweenOrderByDateAsc(child, startDate, endDate);
        List<Appointment> appointmentsInRange = appointmentRepository.findByChildAndStartTimeBetweenOrderByStartTimeAsc(child, start, end);

        LocalDateTime upcomingStart = end.plusSeconds(1);
        LocalDateTime upcomingEnd = end.plusDays(30);
        List<Appointment> upcoming = appointmentRepository.findByChildAndStartTimeBetweenOrderByStartTimeAsc(child, upcomingStart, upcomingEnd);

        ReportData data = new ReportData();
        data.title = title;
        data.timeframe = timeframe;
        data.generatedDate = DATE_FMT.format(LocalDate.now());
        data.childName = child.getName();
        data.childDob = child.getDob() == null ? "--" : DATE_FMT.format(child.getDob());
        data.childAge = child.getDob() == null ? "--" : String.valueOf(Period.between(child.getDob(), LocalDate.now()).getYears());
        data.childGender = child.getGender() == null ? "--" : child.getGender();
        data.childDisability = child.getDisability() == null ? "--" : child.getDisability();

        data.executiveSummary = buildExecutiveSummary(seizures, meds, metrics);
        data.seizureOverview = buildSeizureOverview(seizures);
        data.seizureTimeline = buildSeizureTimeline(seizures);
        data.medSummary = buildMedicationSummary(meds);
        data.fitbitSummary = buildFitbitSummary(metrics);
        data.insights = buildInsights(seizures, meds, metrics, startDate, endDate);
        data.appointments = buildAppointments(appointmentsInRange, upcoming);

        data.heatmapChart = buildHeatmapChart(seizures);
        data.medsChart = buildMedsChart(seizures, meds, startDate, endDate);

        data.summaryJson = buildSummaryJson(data);

        return data;
    }

    private List<String> buildExecutiveSummary(List<SeizureLog> seizures, List<MedicationLog> meds, List<FitBitMetrics> metrics) {
        List<String> bullets = new ArrayList<>();

        bullets.add("Total seizures: " + seizures.size());

        double avgDuration = seizures.stream()
                .map(SeizureLog::getDurationSeconds)
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .average()
                .orElse(0);
        if (avgDuration > 0) {
            bullets.add("Average duration: " + formatDurationSeconds(Math.round(avgDuration)));
        }

        Map<String, Long> types = seizures.stream()
                .map(SeizureLog::getType)
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(s -> s, Collectors.counting()));
        if (!types.isEmpty()) {
            String topType = types.entrySet().stream()
                    .max(Map.Entry.comparingByValue())
                    .get()
                    .getKey();
            bullets.add("Most common type: " + formatLabel(topType));
        }

        Map<String, Long> awareness = seizures.stream()
                .map(SeizureLog::getAwareness)
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(s -> s, Collectors.counting()));
        if (!awareness.isEmpty()) {
            String awarenessText = awareness.entrySet().stream()
                    .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                    .map(e -> formatLabel(e.getKey()) + " (" + e.getValue() + ")")
                    .collect(Collectors.joining(", "));
            bullets.add("Most common awareness state: " + awarenessText);
        }

        IntSummaryStatistics stats = seizures.stream()
                .map(SeizureLog::getDurationSeconds)
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .summaryStatistics();
        if (stats.getCount() > 0) {
            bullets.add("Longest seizure: " + formatDurationSeconds(stats.getMax()));
        }

        MedicationSummary medSummary = buildMedicationSummary(meds);
        bullets.add("Medication adherence: " + medSummary.adherencePercent);

        FitBitSummary fitbitSummary = buildFitbitSummary(metrics);
        bullets.add("Average sleep: " + fitbitSummary.avgSleep);

        return bullets;
    }

    private SeizureOverview buildSeizureOverview(List<SeizureLog> seizures) {
        SeizureOverview overview = new SeizureOverview();
        overview.total = String.valueOf(seizures.size());

        Map<String, Long> types = seizures.stream()
                .map(SeizureLog::getType)
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(s -> s, Collectors.counting()));

        overview.mostCommonType = types.isEmpty()
                ? "--"
                : formatLabel(types.entrySet().stream().max(Map.Entry.comparingByValue()).get().getKey());

        Map<String, Long> awareness = seizures.stream()
                .map(SeizureLog::getAwareness)
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(s -> s, Collectors.counting()));

        overview.awarenessBreakdown = awareness.isEmpty()
                ? "--"
                : awareness.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(e -> formatLabel(e.getKey()) + " (" + e.getValue() + ")")
                .collect(Collectors.joining(", "));

        IntSummaryStatistics stats = seizures.stream()
                .map(SeizureLog::getDurationSeconds)
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .summaryStatistics();

        overview.averageDuration = stats.getCount() == 0 ? "--" : String.format("%.0f sec", stats.getAverage());
        overview.longestDuration = stats.getCount() == 0 ? "--" : formatDurationSeconds(stats.getMax());

        return overview;
    }

    private List<SeizureTimelineRow> buildSeizureTimeline(List<SeizureLog> seizures) {
        return seizures.stream()
                .sorted(Comparator.comparing(SeizureLog::getTimestamp).reversed())
                .limit(10)
                .map(s -> {
                    SeizureTimelineRow row = new SeizureTimelineRow();
                    row.time = s.getTimestamp() == null ? "--" : DATE_TIME_FMT.format(s.getTimestamp());
                    row.type = s.getType() == null ? "--" : formatLabel(s.getType());
                    row.awareness = s.getAwareness() == null ? "--" : formatLabel(s.getAwareness());
                    row.duration = s.getDurationSeconds() == null ? "--" : formatDurationSeconds(s.getDurationSeconds());
                    row.notes = s.getNotes() == null ? "" : s.getNotes();
                    return row;
                })
                .collect(Collectors.toList());
    }

    private MedicationSummary buildMedicationSummary(List<MedicationLog> meds) {
        MedicationSummary summary = new MedicationSummary();
        if (meds.isEmpty()) {
            summary.adherencePercent = "--";
            summary.missedDays = "--";
            summary.medsUsed = "--";
            return summary;
        }

        long takenCount = meds.stream().filter(MedicationLog::isTaken).count();
        summary.adherencePercent = String.format("%.0f%%", (takenCount * 100.0) / meds.size());

        Map<LocalDate, List<MedicationLog>> byDate = meds.stream()
                .collect(Collectors.groupingBy(MedicationLog::getDate));

        List<String> missed = new ArrayList<>();
        for (Map.Entry<LocalDate, List<MedicationLog>> entry : byDate.entrySet()) {
            boolean anyTaken = entry.getValue().stream().anyMatch(MedicationLog::isTaken);
            boolean anyMissed = entry.getValue().stream().anyMatch(m -> !m.isTaken());
            if (!anyTaken && anyMissed) {
                missed.add(DATE_FMT.format(entry.getKey()));
            }
        }
        summary.missedDays = missed.isEmpty() ? "--" : String.join(", ", missed);

        Map<String, Long> medsUsed = meds.stream()
                .map(m -> {
                    String name = m.getMedicationName() == null ? "Unknown" : m.getMedicationName();
                    String dose = m.getDose() == null ? "" : (" " + m.getDose());
                    return name + dose;
                })
                .collect(Collectors.groupingBy(s -> s, Collectors.counting()));

        summary.medsUsed = medsUsed.isEmpty()
                ? "--"
                : medsUsed.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(e -> e.getKey())
                .collect(Collectors.joining(", "));

        return summary;
    }

    private FitBitSummary buildFitbitSummary(List<FitBitMetrics> metrics) {
        FitBitSummary summary = new FitBitSummary();
        if (metrics.isEmpty()) {
            summary.avgSleep = "--";
            summary.avgHeartRate = "--";
            summary.avgHrv = "--";
            summary.lowSleepDays = "--";
            return summary;
        }

        summary.avgSleep = String.format("%.1f h", metrics.stream()
                .map(FitBitMetrics::getSleepHours)
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .average().orElse(0));

        summary.avgHeartRate = String.format("%.0f bpm", metrics.stream()
                .map(FitBitMetrics::getLatestHeartRate)
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .average().orElse(0));

        summary.avgHrv = String.format("%.1f", metrics.stream()
                .map(FitBitMetrics::getHrv)
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .average().orElse(0));

        long lowSleep = metrics.stream()
                .map(FitBitMetrics::getSleepHours)
                .filter(Objects::nonNull)
                .filter(h -> h < 6.0)
                .count();
        summary.lowSleepDays = String.valueOf(lowSleep);

        return summary;
    }

    private List<String> buildInsights(List<SeizureLog> seizures, List<MedicationLog> meds, List<FitBitMetrics> metrics,
                                       LocalDate startDate, LocalDate endDate) {
        List<String> mlInsights = fetchMlInsights();
        if (!mlInsights.isEmpty()) {
            return mlInsights;
        }

        List<String> insights = new ArrayList<>();

        Set<LocalDate> seizureDays = seizures.stream()
                .filter(s -> s.getTimestamp() != null)
                .map(s -> s.getTimestamp().toLocalDate())
                .collect(Collectors.toSet());

        Map<LocalDate, List<MedicationLog>> medsByDate = meds.stream()
                .collect(Collectors.groupingBy(MedicationLog::getDate));

        long seizureWithMissed = seizureDays.stream().filter(date -> {
            List<MedicationLog> dayLogs = medsByDate.getOrDefault(date, List.of());
            boolean anyTaken = dayLogs.stream().anyMatch(MedicationLog::isTaken);
            boolean anyMissed = dayLogs.stream().anyMatch(m -> !m.isTaken());
            return !anyTaken && anyMissed;
        }).count();

        if (!seizureDays.isEmpty() && seizureWithMissed > 0) {
            insights.add("Seizures were more common on days with missed medication.");
        }

        Map<LocalDate, FitBitMetrics> metricsByDate = metrics.stream()
                .collect(Collectors.toMap(FitBitMetrics::getDate, m -> m, (a, b) -> a));

        long lowSleepSeizureDays = seizureDays.stream()
                .filter(d -> metricsByDate.containsKey(d))
                .filter(d -> metricsByDate.get(d).getSleepHours() != null && metricsByDate.get(d).getSleepHours() < 6.0)
                .count();

        if (!seizureDays.isEmpty() && lowSleepSeizureDays > 0) {
            insights.add("Low sleep (<6h) appeared on " + lowSleepSeizureDays + " seizure day(s).");
        }

        if (!seizures.isEmpty()) {
            String topWindow = mostCommonTimeWindow(seizures);
            insights.add("Most seizures happened in the " + topWindow + " time window.");
        }

        if (insights.isEmpty()) {
            insights.add("No strong patterns found in this timeframe.");
        }

        return insights;
    }

    private List<String> fetchMlInsights() {
        try {
            RestTemplate restTemplate = new RestTemplate();
            Map response = restTemplate.getForObject(mlBaseUrl + "/insights", Map.class);
            if (response == null || !response.containsKey("insights")) {
                return List.of();
            }
            Object raw = response.get("insights");
            if (raw instanceof List<?> list) {
                return list.stream().map(String::valueOf).collect(Collectors.toList());
            }
        } catch (Exception ignored) {
            // fall back to rule-based insights
        }
        return List.of();
    }

    private String mostCommonTimeWindow(List<SeizureLog> seizures) {
        Map<String, Long> windowCounts = seizures.stream()
                .filter(s -> s.getTimestamp() != null)
                .map(s -> {
                    int hour = s.getTimestamp().getHour();
                    if (hour <= 5) return "Night";
                    if (hour <= 11) return "Morning";
                    if (hour <= 17) return "Afternoon";
                    return "Evening";
                })
                .collect(Collectors.groupingBy(s -> s, Collectors.counting()));

        return windowCounts.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("Daytime");
    }

    private List<AppointmentRow> buildAppointments(List<Appointment> inRange, List<Appointment> upcoming) {
        List<AppointmentRow> rows = new ArrayList<>();

        for (Appointment appt : inRange) {
            rows.add(new AppointmentRow("In range", formatAppointment(appt)));
        }

        for (Appointment appt : upcoming.stream().limit(5).collect(Collectors.toList())) {
            rows.add(new AppointmentRow("Upcoming", formatAppointment(appt)));
        }

        return rows;
    }

    private String formatAppointment(Appointment appt) {
        if (appt.getStartTime() == null) return "--";
        String label = DATE_TIME_FMT.format(appt.getStartTime());
        if (appt.getTitle() != null && !appt.getTitle().isBlank()) {
            label += " - " + appt.getTitle();
        }
        return label;
    }

    private String buildHeatmapChart(List<SeizureLog> seizures) {
        int rows = 7;
        int cols = 4;
        int[][] counts = new int[rows][cols];

        for (SeizureLog s : seizures) {
            if (s.getTimestamp() == null) continue;
            LocalDateTime ts = s.getTimestamp();
            int dayIndex = (ts.getDayOfWeek().getValue() + 6) % 7;
            int hour = ts.getHour();
            int col = hour <= 5 ? 0 : hour <= 11 ? 1 : hour <= 17 ? 2 : 3;
            counts[dayIndex][col]++;
        }

        int max = Arrays.stream(counts)
                .flatMapToInt(arr -> Arrays.stream(arr))
                .max()
                .orElse(1);

        int cell = 40;
        int paddingLeft = 80;
        int paddingTop = 40;
        int width = paddingLeft + cols * cell + 20;
        int height = paddingTop + rows * cell + 30;

        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = image.createGraphics();

        g.setColor(Color.WHITE);
        g.fillRect(0, 0, width, height);
        g.setFont(new Font("SansSerif", Font.PLAIN, 12));

        String[] colLabels = {"Night", "Morning", "Afternoon", "Evening"};
        String[] rowLabels = {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"};

        for (int c = 0; c < cols; c++) {
            g.setColor(Color.DARK_GRAY);
            g.drawString(colLabels[c], paddingLeft + c * cell + 5, 25);
        }

        for (int r = 0; r < rows; r++) {
            g.setColor(Color.DARK_GRAY);
            g.drawString(rowLabels[r], 20, paddingTop + r * cell + 25);
        }

        Color base = new Color(72, 128, 200);

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                float intensity = counts[r][c] / (float) max;
                Color cellColor = blend(Color.WHITE, base, intensity);
                int x = paddingLeft + c * cell;
                int y = paddingTop + r * cell;
                g.setColor(cellColor);
                g.fillRect(x, y, cell, cell);
                g.setColor(Color.GRAY);
                g.drawRect(x, y, cell, cell);
                if (counts[r][c] > 0) {
                    g.setColor(Color.BLACK);
                    g.drawString(String.valueOf(counts[r][c]), x + 15, y + 22);
                }
            }
        }

        g.dispose();
        return "data:image/png;base64," + encodeImage(image);
    }

    private String buildMedsChart(List<SeizureLog> seizures, List<MedicationLog> meds, LocalDate startDate, LocalDate endDate) {
        Set<LocalDate> seizureDays = seizures.stream()
                .filter(s -> s.getTimestamp() != null)
                .map(s -> s.getTimestamp().toLocalDate())
                .collect(Collectors.toSet());

        Map<LocalDate, List<MedicationLog>> medsByDate = meds.stream()
                .collect(Collectors.groupingBy(MedicationLog::getDate));

        int seizureOnTaken = 0;
        int seizureOnMissed = 0;

        LocalDate current = startDate;
        while (!current.isAfter(endDate)) {
            List<MedicationLog> dayLogs = medsByDate.getOrDefault(current, List.of());
            boolean anyTaken = dayLogs.stream().anyMatch(MedicationLog::isTaken);
            boolean anyMissed = dayLogs.stream().anyMatch(m -> !m.isTaken());
            boolean hadSeizure = seizureDays.contains(current);

            if (hadSeizure) {
                if (anyTaken) seizureOnTaken++;
                else if (anyMissed) seizureOnMissed++;
            }
            current = current.plusDays(1);
        }

        int width = 320;
        int height = 200;
        int padding = 40;

        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = image.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, width, height);
        g.setFont(new Font("SansSerif", Font.PLAIN, 12));

        int max = Math.max(1, Math.max(seizureOnTaken, seizureOnMissed));
        int chartHeight = height - padding * 2;
        int barWidth = 70;
        int gap = 40;

        int takenBar = (int) (chartHeight * (seizureOnTaken / (double) max));
        int missedBar = (int) (chartHeight * (seizureOnMissed / (double) max));

        int baseY = height - padding;
        int takenX = padding + 10;
        int missedX = takenX + barWidth + gap;

        g.setColor(new Color(90, 170, 120));
        g.fillRect(takenX, baseY - takenBar, barWidth, takenBar);
        g.setColor(new Color(200, 90, 90));
        g.fillRect(missedX, baseY - missedBar, barWidth, missedBar);

        g.setColor(Color.DARK_GRAY);
        g.drawString("Meds taken", takenX - 2, baseY + 15);
        g.drawString("Meds missed", missedX - 4, baseY + 15);
        g.drawString(String.valueOf(seizureOnTaken), takenX + 25, baseY - takenBar - 5);
        g.drawString(String.valueOf(seizureOnMissed), missedX + 25, baseY - missedBar - 5);

        g.dispose();
        return "data:image/png;base64," + encodeImage(image);
    }

    private Color blend(Color a, Color b, float t) {
        int r = (int) (a.getRed() + (b.getRed() - a.getRed()) * t);
        int g = (int) (a.getGreen() + (b.getGreen() - a.getGreen()) * t);
        int bl = (int) (a.getBlue() + (b.getBlue() - a.getBlue()) * t);
        return new Color(r, g, bl);
    }

    private String encodeImage(BufferedImage image) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            ImageIO.write(image, "png", baos);
            return Base64.getEncoder().encodeToString(baos.toByteArray());
        } catch (IOException e) {
            return "";
        }
    }

    private Path resolveStorageDir() {
        Path path = Paths.get(reportsStoragePath);
        if (!path.isAbsolute()) {
            path = Paths.get(System.getProperty("user.dir")).resolve(path);
        }
        try {
            Files.createDirectories(path);
        } catch (IOException e) {
            throw new RuntimeException("Failed to create reports directory");
        }
        return path;
    }

    private void generatePdf(ReportData data, Path pdfPath) {
        Context context = new Context();
        context.setVariable("data", data);
        String html = templateEngine.process("report", context);

        try {
            Files.createDirectories(pdfPath.getParent());
            try (var os = Files.newOutputStream(pdfPath)) {
                PdfRendererBuilder builder = new PdfRendererBuilder();
                builder.useFastMode();
                builder.withHtmlContent(html, pdfPath.getParent().toUri().toString());
                builder.toStream(os);
                builder.run();
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to render report PDF: " + e.getMessage(), e);
        }
    }

    private String formatTimeframe(LocalDate start, LocalDate end) {
        if (start.equals(end)) {
            return DATE_FMT.format(start);
        }
        return DATE_FMT.format(start) + "–" + DATE_FMT.format(end);
    }

    private String buildTitle(String timeframe, String titleInput) {
        String suffix = (titleInput == null || titleInput.isBlank()) ? "Medical Report" : titleInput.trim();
        return timeframe + " - " + suffix;
    }

    private String formatDurationSeconds(long seconds) {
        long mins = seconds / 60;
        long secs = seconds % 60;
        if (mins <= 0) {
            return secs + " sec";
        }
        return mins + " min " + secs + " sec";
    }

    private String formatLabel(String raw) {
        if (raw == null || raw.isBlank()) return "--";
        String clean = raw.replace('_', ' ').toLowerCase(Locale.ENGLISH);
        String[] parts = clean.split("\\s+");
        StringBuilder out = new StringBuilder();
        for (String part : parts) {
            if (part.isBlank()) continue;
            out.append(Character.toUpperCase(part.charAt(0)))
                    .append(part.substring(1))
                    .append(' ');
        }
        return out.toString().trim();
    }

    private Map<String, Object> buildSummaryJson(ReportData data) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("title", data.title);
        summary.put("timeframe", data.timeframe);
        summary.put("totalSeizures", data.seizureOverview.total);
        summary.put("medAdherence", data.medSummary.adherencePercent);
        summary.put("avgSleep", data.fitbitSummary.avgSleep);
        summary.put("insights", data.insights);
        return summary;
    }

    public static class ReportData {
        public String title;
        public String timeframe;
        public String generatedDate;
        public String childName;
        public String childDob;
        public String childAge;
        public String childGender;
        public String childDisability;

        public List<String> executiveSummary;
        public SeizureOverview seizureOverview;
        public List<SeizureTimelineRow> seizureTimeline;
        public MedicationSummary medSummary;
        public FitBitSummary fitbitSummary;
        public List<String> insights;
        public List<AppointmentRow> appointments;

        public String heatmapChart;
        public String medsChart;

        public Map<String, Object> summaryJson;
    }

    public static class SeizureOverview {
        public String total;
        public String mostCommonType;
        public String awarenessBreakdown;
        public String averageDuration;
        public String longestDuration;
    }

    public static class SeizureTimelineRow {
        public String time;
        public String type;
        public String awareness;
        public String duration;
        public String notes;
    }

    public static class MedicationSummary {
        public String adherencePercent;
        public String missedDays;
        public String medsUsed;
    }

    public static class FitBitSummary {
        public String avgSleep;
        public String avgHeartRate;
        public String avgHrv;
        public String lowSleepDays;
    }

    public static class AppointmentRow {
        public String label;
        public String value;

        public AppointmentRow(String label, String value) {
            this.label = label;
            this.value = value;
        }
    }
}

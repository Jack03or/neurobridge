package com.example.demo.controller;

import com.example.demo.model.Report;
import com.example.demo.service.ReportService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
@CrossOrigin(origins = "*")
public class ReportController {

    @Autowired
    private ReportService reportService;

    @PostMapping("/by-user/{userId}")
    public ResponseEntity<?> generateReport(@PathVariable Long userId, @RequestBody ReportRequest request) {
        try {
            Report report = reportService.generateReportForUser(
                    userId,
                    request.startDate,
                    request.endDate,
                    request.title
            );
            ReportService.ReportData data = reportService.getReportDataForReport(report);

            Map<String, Object> payload = new java.util.LinkedHashMap<>();
            payload.put("reportId", report.getId());
            payload.put("title", report.getTitle());
            payload.put("startDate", report.getStartDate());
            payload.put("endDate", report.getEndDate());
            payload.put("createdAt", report.getCreatedAt());
            payload.put("downloadUrl", "/api/reports/" + report.getId() + "/pdf");
            payload.put("reportData", data);
            return ResponseEntity.ok(payload);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.internalServerError().body("Failed to generate report: " + ex.getMessage());
        }
    }

    @GetMapping("/by-user/{userId}")
    public ResponseEntity<?> listReports(@PathVariable Long userId) {
        List<Report> reports = reportService.getReportsForUser(userId);
        List<Map<String, Object>> payload = reports.stream().map(r -> {
            Map<String, Object> row = new java.util.LinkedHashMap<>();
            row.put("reportId", r.getId());
            row.put("title", r.getTitle());
            row.put("startDate", r.getStartDate());
            row.put("endDate", r.getEndDate());
            row.put("createdAt", r.getCreatedAt());
            row.put("downloadUrl", "/api/reports/" + r.getId() + "/pdf");
            return row;
        }).toList();
        return ResponseEntity.ok(payload);
    }

    @GetMapping("/{reportId}/pdf")
    public ResponseEntity<?> downloadReport(@PathVariable Long reportId) {
        return reportService.getReport(reportId)
                .map(report -> {
                    try {
                        Path path = Path.of(report.getFilePath());
                        byte[] bytes = Files.readAllBytes(path);
                        ByteArrayResource resource = new ByteArrayResource(bytes);

                        return ResponseEntity.ok()
                                .contentType(MediaType.APPLICATION_PDF)
                                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"report-" + reportId + ".pdf\"")
                                .body(resource);
                    } catch (Exception e) {
                        return ResponseEntity.internalServerError().body("Failed to load report");
                    }
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{reportId}/data")
    public ResponseEntity<?> getReportData(@PathVariable Long reportId) {
        return reportService.getReport(reportId)
                .map(report -> ResponseEntity.ok(reportService.getReportDataForReport(report)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    public static class ReportRequest {
        public LocalDate startDate;
        public LocalDate endDate;
        public String type;
        public String title;
    }
}

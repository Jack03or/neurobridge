package com.example.demo.controller;

import com.example.demo.model.Child;
import com.example.demo.model.MedicationLog;
import com.example.demo.model.MedicationSchedule;
import com.example.demo.model.User;
import com.example.demo.repository.ChildRepository;
import com.example.demo.repository.MedicationLogRepository;
import com.example.demo.repository.MedicationScheduleRepository;
import com.example.demo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/medications")
@CrossOrigin(origins = "*")
public class MedicationLogController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ChildRepository childRepository;

    @Autowired
    private MedicationLogRepository medicationLogRepository;

    @Autowired
    private MedicationScheduleRepository medicationScheduleRepository;

    @PostMapping("/by-user/{userId}")
    public ResponseEntity<?> create(@PathVariable Long userId, @RequestBody CreateMedicationRequest req) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");

        Child child = resolveChild(userId);
        if (child == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("No child linked to this user");

        if (req.date == null) return ResponseEntity.badRequest().body("date is required");
        if (req.taken == null) return ResponseEntity.badRequest().body("taken is required");

        MedicationLog log = new MedicationLog();
        log.setChild(child);

        if (req.scheduleId != null) {
            MedicationSchedule schedule = medicationScheduleRepository.findById(req.scheduleId).orElse(null);
            if (schedule != null && schedule.getChild().getId().equals(child.getId())) {
                log.setSchedule(schedule);
                if (req.medicationName == null || req.medicationName.isBlank()) {
                    req.medicationName = schedule.getMedicationName();
                }
                if (req.dose == null || req.dose.isBlank()) {
                    req.dose = schedule.getDose();
                }
            }
        }

        log.setMedicationName(req.medicationName);
        log.setDose(req.dose);
        log.setDate(req.date);
        log.setTaken(req.taken);
        log.setTakenAt(req.takenAt);

        return ResponseEntity.ok(medicationLogRepository.save(log));
    }

    @PostMapping("/mark-taken/by-user/{userId}")
    public ResponseEntity<?> markTaken(@PathVariable Long userId, @RequestBody MarkTakenRequest req) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");

        Child child = resolveChild(userId);
        if (child == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("No child linked to this user");
        if (req.scheduleId == null) return ResponseEntity.badRequest().body("scheduleId is required");

        MedicationSchedule schedule = medicationScheduleRepository.findById(req.scheduleId).orElse(null);
        if (schedule == null || !schedule.getChild().getId().equals(child.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Schedule not found for this child");
        }

        LocalDate date = req.date == null ? LocalDate.now() : req.date;
        LocalDateTime takenAt = req.takenAt == null ? LocalDateTime.now() : req.takenAt;

        List<MedicationLog> existingLogs = medicationLogRepository
                .findByChildAndDateAndScheduleOrderByTakenAtDescIdDesc(child, date, schedule);

        MedicationLog log = existingLogs.isEmpty() ? new MedicationLog() : existingLogs.get(0);

        log.setChild(child);
        log.setSchedule(schedule);
        log.setMedicationName(schedule.getMedicationName());
        log.setDose(schedule.getDose());
        log.setDate(date);
        log.setTaken(true);
        log.setTakenAt(takenAt);

        return ResponseEntity.ok(medicationLogRepository.save(log));
    }

    @GetMapping("/by-user/{userId}")
    public ResponseEntity<?> list(
            @PathVariable Long userId,
            @RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to
    ) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");

        Child child = resolveChild(userId);
        if (child == null) return ResponseEntity.ok(List.of());

        if (from != null && to != null) {
            return ResponseEntity.ok(medicationLogRepository.findByChildAndDateBetweenOrderByDateDesc(child, from, to));
        }

        return ResponseEntity.ok(medicationLogRepository.findByChildOrderByDateDesc(child));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!medicationLogRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Medication log not found");
        }
        medicationLogRepository.deleteById(id);
        return ResponseEntity.ok("Deleted");
    }

    public static class CreateMedicationRequest {
        public String medicationName;
        public String dose;
        public LocalDate date;
        public Boolean taken;
        public LocalDateTime takenAt;
        public Long scheduleId;
    }

    public static class MarkTakenRequest {
        public Long scheduleId;
        public LocalDate date;
        public LocalDateTime takenAt;
    }

    private Child resolveChild(Long userId) {
        if (userId == null) {
            return null;
        }

        return childRepository.findAllByUserIdOrderByCreatedAtDescIdDesc(userId).stream()
                .findFirst()
                .orElse(null);
    }
}

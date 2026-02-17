package com.example.demo.controller;

import com.example.demo.model.Child;
import com.example.demo.model.MedicationSchedule;
import com.example.demo.model.User;
import com.example.demo.repository.ChildRepository;
import com.example.demo.repository.MedicationScheduleRepository;
import com.example.demo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/medication-schedules")
@CrossOrigin(origins = "*")
public class MedicationScheduleController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ChildRepository childRepository;

    @Autowired
    private MedicationScheduleRepository medicationScheduleRepository;

    @GetMapping("/by-user/{userId}")
    public ResponseEntity<?> listByUser(@PathVariable Long userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");

        Child child = childRepository.findByUserId(userId).orElse(null);
        if (child == null) return ResponseEntity.ok(List.of());

        return ResponseEntity.ok(medicationScheduleRepository.findByChildAndActiveTrueOrderByCreatedAtAsc(child));
    }

    @PostMapping("/by-user/{userId}")
    public ResponseEntity<?> create(@PathVariable Long userId, @RequestBody UpsertMedicationScheduleRequest req) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");

        Child child = childRepository.findByUserId(userId).orElse(null);
        if (child == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("No child linked to this user");

        if (req.medicationName == null || req.medicationName.isBlank()) {
            return ResponseEntity.badRequest().body("medicationName is required");
        }

        MedicationSchedule schedule = new MedicationSchedule();
        schedule.setChild(child);
        schedule.setMedicationName(req.medicationName.trim());
        schedule.setDose(req.dose == null ? null : req.dose.trim());
        schedule.setDefaultTime(req.defaultTime);
        schedule.setActive(true);

        return ResponseEntity.ok(medicationScheduleRepository.save(schedule));
    }

    @PutMapping("/{scheduleId}")
    public ResponseEntity<?> update(@PathVariable Long scheduleId, @RequestBody UpsertMedicationScheduleRequest req) {
        MedicationSchedule schedule = medicationScheduleRepository.findById(scheduleId).orElse(null);
        if (schedule == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Schedule not found");

        if (req.medicationName != null && !req.medicationName.isBlank()) {
            schedule.setMedicationName(req.medicationName.trim());
        }
        if (req.dose != null) {
            schedule.setDose(req.dose.trim());
        }
        if (req.defaultTime != null) {
            schedule.setDefaultTime(req.defaultTime);
        }
        if (req.active != null) {
            schedule.setActive(req.active);
        }

        return ResponseEntity.ok(medicationScheduleRepository.save(schedule));
    }

    @DeleteMapping("/{scheduleId}")
    public ResponseEntity<?> deactivate(@PathVariable Long scheduleId) {
        MedicationSchedule schedule = medicationScheduleRepository.findById(scheduleId).orElse(null);
        if (schedule == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Schedule not found");

        schedule.setActive(false);
        medicationScheduleRepository.save(schedule);
        return ResponseEntity.ok(Map.of("message", "Schedule deactivated"));
    }

    public static class UpsertMedicationScheduleRequest {
        public String medicationName;
        public String dose;
        public LocalTime defaultTime;
        public Boolean active;
    }
}


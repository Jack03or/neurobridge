package com.example.demo.controller;

import com.example.demo.model.Child;
import com.example.demo.model.MedicationLog;
import com.example.demo.model.User;
import com.example.demo.repository.ChildRepository;
import com.example.demo.repository.MedicationLogRepository;
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

    @Autowired private UserRepository userRepository;
    @Autowired private ChildRepository childRepository;
    @Autowired private MedicationLogRepository medicationLogRepository;

    // CREATE 
    @PostMapping("/by-user/{userId}")
    public ResponseEntity<?> create(@PathVariable Long userId, @RequestBody CreateMedicationRequest req) {

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");

        Child child = childRepository.findByUserId(userId).orElse(null);
        if (child == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("No child linked to this user");

        if (req.date == null) return ResponseEntity.badRequest().body("date is required");
        if (req.taken == null) return ResponseEntity.badRequest().body("taken is required");

        MedicationLog log = new MedicationLog();
        log.setChild(child);

        // for now not needed
        log.setMedicationName(req.medicationName);
        log.setDose(req.dose);

        log.setDate(req.date);
        log.setTaken(req.taken);

        // if they mark taken and provide time, store it
        // if taken=false and they provide a time (optional), still store it as "logged at"
        log.setTakenAt(req.takenAt);

        MedicationLog saved = medicationLogRepository.save(log);
        return ResponseEntity.ok(saved);
    }

    // READ
    // get all for user, with optional date range filtering
    @GetMapping("/by-user/{userId}")
    public ResponseEntity<?> list(
            @PathVariable Long userId,
            @RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to
    ) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");

        Child child = childRepository.findByUserId(userId).orElse(null);
        if (child == null) return ResponseEntity.ok(List.of());

        if (from != null && to != null) {
            return ResponseEntity.ok(
                    medicationLogRepository.findByChildAndDateBetweenOrderByDateDesc(child, from, to)
            );
        }

        return ResponseEntity.ok(medicationLogRepository.findByChildOrderByDateDesc(child));
    }

    // DELETE
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!medicationLogRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Medication log not found");
        }
        medicationLogRepository.deleteById(id);
        return ResponseEntity.ok("Deleted");
    }

    //DTO 
    public static class CreateMedicationRequest {
        public String medicationName; // optional for now need to see what i can do with api
        public String dose;           // optional for now cus same reason as above

        // required
        public LocalDate date;

        // required: true = taken, false = missed
        public Boolean taken;

        // optional (lets diary show a time instead of “Logged”)
        public LocalDateTime takenAt;
    }
}

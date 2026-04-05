package com.example.demo.controller;

import com.example.demo.model.Child;
import com.example.demo.model.SeizureLog;
import com.example.demo.model.User;
import com.example.demo.repository.ChildRepository;
import com.example.demo.repository.SeizureLogRepository;
import com.example.demo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/seizures")
@CrossOrigin(origins = "*")
public class SeizureLogController {

    @Autowired private UserRepository userRepository;
    @Autowired private ChildRepository childRepository;
    @Autowired private SeizureLogRepository seizureLogRepository;

    //CREATE 
    @PostMapping("/by-user/{userId}")
    public ResponseEntity<?> createSeizure(@PathVariable Long userId, @RequestBody CreateSeizureRequest req) {

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");

        Child child = childRepository.findByUserId(userId).orElse(null);
        if (child == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("No child linked to this user");

        if (req.timestamp == null) return ResponseEntity.badRequest().body("timestamp is required");
        if (req.awareness == null || req.awareness.isBlank()) return ResponseEntity.badRequest().body("awareness is required");

        SeizureLog log = new SeizureLog();
        log.setChild(child);
        log.setTimestamp(req.timestamp);

        // store symptoms as CSV in seizure_type
        if (req.symptoms != null && !req.symptoms.isEmpty()) {
            log.setType(String.join(", ", req.symptoms));
        } else {
            log.setType(req.symptomsNone != null && req.symptomsNone ? "NONE" : null);
        }

        log.setAwareness(req.awareness);

        log.setDurationSeconds(req.durationSeconds);
        log.setPatientState(req.patientState);

        log.setMedsTaken(req.medsTaken);
        log.setInterventionNeeded(req.interventionNeeded);
        log.setTongueBite(req.tongueBite);
        log.setActivityState(req.activityState);
        log.setIncontinence(req.incontinence);

        if (req.potentialTriggers != null && !req.potentialTriggers.isEmpty()) {
            String triggerCsv = req.potentialTriggers.stream()
                    .filter(item -> item != null && !item.isBlank())
                    .collect(Collectors.joining(", "));
            log.setSeizureTrigger(triggerCsv.isBlank() ? null : triggerCsv);
        } else {
            log.setSeizureTrigger(req.seizureTrigger);
        }

        log.setHoursSinceLastMeal(req.hoursSinceLastMeal);

        log.setPostEffects(req.postEffects);
        log.setNotes(req.notes);

        SeizureLog saved = seizureLogRepository.save(log);
        return ResponseEntity.ok(saved);
    }

    // ---------------- READ (LIST) ----------------
    @GetMapping("/by-user/{userId}")
    public ResponseEntity<?> listSeizures(@PathVariable Long userId) {

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");

        Child child = childRepository.findByUserId(userId).orElse(null);
        if (child == null) return ResponseEntity.ok(List.of());

        return ResponseEntity.ok(seizureLogRepository.findByChildOrderByTimestampDesc(child));
    }

    // ---------------- READ (LATEST) ----------------
    @GetMapping("/by-user/{userId}/latest")
    public ResponseEntity<?> latestSeizure(@PathVariable Long userId) {

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");

        Child child = childRepository.findByUserId(userId).orElse(null);
        if (child == null) return ResponseEntity.ok(null);

        Optional<SeizureLog> latest = seizureLogRepository.findFirstByChildOrderByTimestampDesc(child);
        return ResponseEntity.ok(latest.orElse(null));
    }

    // ---------------- DELETE ----------------
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!seizureLogRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Seizure not found");
        }
        seizureLogRepository.deleteById(id);
        return ResponseEntity.ok("Deleted");
    }

    // ------------ DTO ------------
    public static class CreateSeizureRequest {
        public LocalDateTime timestamp;

        // symptom tiles chosen (twitch, jerk, etc.)
        public List<String> symptoms;

        // if user pressed "None"
        public Boolean symptomsNone;

        // awareness choice is required: AWARE / IMPAIRED / LOSS_OF_CONSCIOUSNESS / OTHER / NONE
        public String awareness;

        public Integer durationSeconds;

        public String patientState; // AWAKE / DROWSY / ASLEEP
        public Boolean medsTaken;
        public Boolean interventionNeeded;
        public Boolean tongueBite;
        public String activityState; // ACTIVE / RESTING
        public Boolean incontinence;

        // renamed from trigger -> seizureTrigger cus of db reserved word
        public String seizureTrigger;
        public List<String> potentialTriggers;
        public Integer hoursSinceLastMeal;

        public String postEffects;
        public String notes;
    }
}

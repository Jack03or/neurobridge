package com.example.demo.controller;

import com.example.demo.model.Appointment;
import com.example.demo.model.Child;
import com.example.demo.model.User;
import com.example.demo.repository.AppointmentRepository;
import com.example.demo.repository.ChildRepository;
import com.example.demo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/appointments")
@CrossOrigin(origins = "*")
public class AppointmentController {

    @Autowired private UserRepository userRepository;
    @Autowired private ChildRepository childRepository;
    @Autowired private AppointmentRepository appointmentRepository;

    // CREATE and UPDATE 
    @PostMapping("/by-user/{userId}")
    public ResponseEntity<?> upsert(@PathVariable Long userId, @RequestBody AppointmentRequest req) {

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");

        Child child = childRepository.findByUserId(userId).orElse(null);
        if (child == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("No child linked to this user");

        if (req.startTime == null) return ResponseEntity.badRequest().body("startTime is required");

        Appointment appt;
        if (req.id != null) {
            appt = appointmentRepository.findById(req.id).orElse(new Appointment());
        } else {
            appt = new Appointment();
        }

        appt.setChild(child);
        appt.setStartTime(req.startTime);
        appt.setEndTime(req.endTime);

        appt.setTitle(req.title);
        appt.setLocation(req.location);
        appt.setNotes(req.notes);

        Appointment saved = appointmentRepository.save(appt);
        return ResponseEntity.ok(saved);
    }

    // LIST
    @GetMapping("/by-user/{userId}")
    public ResponseEntity<?> list(@PathVariable Long userId) {

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");

        Child child = childRepository.findByUserId(userId).orElse(null);
        if (child == null) return ResponseEntity.ok(List.of());

        return ResponseEntity.ok(appointmentRepository.findByChildOrderByStartTimeDesc(child));
    }

    // DELETE
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!appointmentRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Appointment not found");
        }
        appointmentRepository.deleteById(id);
        return ResponseEntity.ok("Deleted");
    }

    // DTO
    public static class AppointmentRequest {
        public Long id;
        public LocalDateTime startTime;
        public LocalDateTime endTime;
        public String title;
        public String location;
        public String notes;
    }
}

package com.example.demo.controller;

import com.example.demo.model.Child;
import com.example.demo.model.FitBitMetrics;
import com.example.demo.model.User;
import com.example.demo.repository.ChildRepository;
import com.example.demo.repository.UserRepository;
import com.example.demo.service.FitbitService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

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

    @GetMapping("/by-user/{userId}")
    public ResponseEntity<?> getDashboardForUser(@PathVariable Long userId) {

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }

        Child child = childRepository.findByUserId(userId).orElse(null);
        if (child == null) {
            DashboardResponse response = new DashboardResponse();
            response.setHasChild(false);
            response.setMessage("No child linked to this user yet.");
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

        FitBitMetrics metrics = fitbitService.getOrCreateTodayMetrics(child);

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

        // seizure + medication still fake for now
        response.setLastSeizureText("--");
        response.setMedicationTakenToday(false);
        response.setMedicationStatusText("Not logged");

        return ResponseEntity.ok(response);
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

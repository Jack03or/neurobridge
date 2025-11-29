package com.example.demo.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "fitbit_metrics")
public class FitBitMetrics {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // which child these metrics belong to
    @ManyToOne(optional = false)
    @JoinColumn(name = "child_id")
    private Child child;

    // the calendar date these metrics are for (today, yesterday, etc.)
    @Column(nullable = false)
    private LocalDate date;

    // how many hours of sleep they got that night (e.g. 7.5)
    @Column(name = "sleep_hours")
    private Double sleepHours;

    // the latest heart rate value we pulled from Fitbit
    @Column(name = "latest_heart_rate")
    private Integer latestHeartRate;

    // when that heart rate was recorded (so I can say "1 min ago" on the UI)
    @Column(name = "latest_heart_rate_at")
    private LocalDateTime latestHeartRateAt;

    // HRV summary for that day (e.g. RMSSD or some score)
    @Column(name = "hrv")
    private Double hrv;

    // ---------- ML DAILY RISK FIELDS ----------

    @Column(name = "risk_percent")
    private Integer riskPercent;

    @Column(name = "risk_level", length = 20)
    private String riskLevel;

    @Column(name = "risk_calculated_at")
    private LocalDateTime riskCalculatedAt;

    // when this record was created in my system
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    // ----- getters and setters -----

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Child getChild() {
        return child;
    }

    public void setChild(Child child) {
        this.child = child;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public Double getSleepHours() {
        return sleepHours;
    }

    public void setSleepHours(Double sleepHours) {
        this.sleepHours = sleepHours;
    }

    public Integer getLatestHeartRate() {
        return latestHeartRate;
    }

    public void setLatestHeartRate(Integer latestHeartRate) {
        this.latestHeartRate = latestHeartRate;
    }

    public LocalDateTime getLatestHeartRateAt() {
        return latestHeartRateAt;
    }

    public void setLatestHeartRateAt(LocalDateTime latestHeartRateAt) {
        this.latestHeartRateAt = latestHeartRateAt;
    }

    public Double getHrv() {
        return hrv;
    }

    public void setHrv(Double hrv) {
        this.hrv = hrv;
    }

    public Integer getRiskPercent() {
        return riskPercent;
    }

    public void setRiskPercent(Integer riskPercent) {
        this.riskPercent = riskPercent;
    }

    public String getRiskLevel() {
        return riskLevel;
    }

    public void setRiskLevel(String riskLevel) {
        this.riskLevel = riskLevel;
    }

    public LocalDateTime getRiskCalculatedAt() {
        return riskCalculatedAt;
    }

    public void setRiskCalculatedAt(LocalDateTime riskCalculatedAt) {
        this.riskCalculatedAt = riskCalculatedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}

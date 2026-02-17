package com.example.demo.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "medication_log")
public class MedicationLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // which child this medication entry belongs to
    @ManyToOne(optional = false)
    @JoinColumn(name = "child_id")
    private Child child;

    @ManyToOne
    @JoinColumn(name = "schedule_id")
    private MedicationSchedule schedule;

    // name of the medication (optional if I want a very simple version)
    @Column(name = "medication_name", length = 100)
    private String medicationName;

    // dose info like "5ml" or "50mg"
    @Column(length = 50)
    private String dose;

    // the day this dose applies to (used to check "taken today?")
    @Column(nullable = false)
    private LocalDate date;

    // true if the parent confirmed they took it
    @Column(nullable = false)
    private boolean taken = false;

    // actual time they logged taking it (if they log the exact time)
    @Column(name = "taken_at")
    private LocalDateTime takenAt;

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

    public MedicationSchedule getSchedule() {
        return schedule;
    }

    public void setSchedule(MedicationSchedule schedule) {
        this.schedule = schedule;
    }

    public String getMedicationName() {
        return medicationName;
    }

    public void setMedicationName(String medicationName) {
        this.medicationName = medicationName;
    }

    public String getDose() {
        return dose;
    }

    public void setDose(String dose) {
        this.dose = dose;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public boolean isTaken() {
        return taken;
    }

    public void setTaken(boolean taken) {
        this.taken = taken;
    }

    public LocalDateTime getTakenAt() {
        return takenAt;
    }

    public void setTakenAt(LocalDateTime takenAt) {
        this.takenAt = takenAt;
    }
}

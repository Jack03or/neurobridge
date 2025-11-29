package com.example.demo.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "seizure_log")
public class SeizureLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // which child this seizure belongs to
    @ManyToOne(optional = false)
    @JoinColumn(name = "child_id")
    private Child child;

    // when the seizure happened
    @Column(nullable = false)
    private LocalDateTime timestamp;

    // simple label for the type (eye roll, blank stare, etc.)
    @Column(name = "seizure_type", length = 100)
    private String type;

    // how long the seizure lasted (in seconds) – optional
    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    // possible trigger written by the parent (e.g. lack of sleep, flashing lights)
    @Column(length = 255)
    private String trigger;

    // what happened afterwards (e.g. tired, confused)
    @Column(name = "post_effects", length = 255)
    private String postEffects;

    // free text notes if they want to add more detail
    @Column(length = 500)
    private String notes;

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

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Integer getDurationSeconds() {
        return durationSeconds;
    }

    public void setDurationSeconds(Integer durationSeconds) {
        this.durationSeconds = durationSeconds;
    }

    public String getTrigger() {
        return trigger;
    }

    public void setTrigger(String trigger) {
        this.trigger = trigger;
    }

    public String getPostEffects() {
        return postEffects;
    }

    public void setPostEffects(String postEffects) {
        this.postEffects = postEffects;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }
}

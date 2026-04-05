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

    /**
     * Selected symptoms as CSV
     * Example: "Twitch, Jerk, Eye roll, Convulsions, Muscle spasm"
     */
    @Column(name = "seizure_type", length = 255)
    private String type;

    // awareness choice
    @Column(name = "awareness", length = 50)
    private String awareness;

    // duration in seconds
    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    // AWAKE / TIRED / ASLEEP
    @Column(name = "patient_state", length = 30)
    private String patientState;

    // meds taken around seizure time
    @Column(name = "meds_taken")
    private Boolean medsTaken;

    @Column(name = "intervention_needed")
    private Boolean interventionNeeded;

    @Column(name = "tongue_bite")
    private Boolean tongueBite;

    // ACTIVE / RESTING
    @Column(name = "activity_state", length = 30)
    private String activityState;

    @Column(name = "incontinence")
    private Boolean incontinence;

    // renamed from "trigger" (MySQL reserved word)
    @Column(name = "seizure_trigger", length = 255)
    private String seizureTrigger;

    @Column(name = "hours_since_last_meal")
    private Integer hoursSinceLastMeal;

    @Column(name = "post_effects", length = 255)
    private String postEffects;

    // free text notes
    @Column(length = 1000)
    private String notes;

    // ----- getters and setters -----

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Child getChild() { return child; }
    public void setChild(Child child) { this.child = child; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getAwareness() { return awareness; }
    public void setAwareness(String awareness) { this.awareness = awareness; }

    public Integer getDurationSeconds() { return durationSeconds; }
    public void setDurationSeconds(Integer durationSeconds) { this.durationSeconds = durationSeconds; }

    public String getPatientState() { return patientState; }
    public void setPatientState(String patientState) { this.patientState = patientState; }

    public Boolean getMedsTaken() { return medsTaken; }
    public void setMedsTaken(Boolean medsTaken) { this.medsTaken = medsTaken; }

    public Boolean getInterventionNeeded() { return interventionNeeded; }
    public void setInterventionNeeded(Boolean interventionNeeded) { this.interventionNeeded = interventionNeeded; }

    public Boolean getTongueBite() { return tongueBite; }
    public void setTongueBite(Boolean tongueBite) { this.tongueBite = tongueBite; }

    public String getActivityState() { return activityState; }
    public void setActivityState(String activityState) { this.activityState = activityState; }

    public Boolean getIncontinence() { return incontinence; }
    public void setIncontinence(Boolean incontinence) { this.incontinence = incontinence; }

    public String getSeizureTrigger() { return seizureTrigger; }
    public void setSeizureTrigger(String seizureTrigger) { this.seizureTrigger = seizureTrigger; }

    public Integer getHoursSinceLastMeal() { return hoursSinceLastMeal; }
    public void setHoursSinceLastMeal(Integer hoursSinceLastMeal) { this.hoursSinceLastMeal = hoursSinceLastMeal; }

    public String getPostEffects() { return postEffects; }
    public void setPostEffects(String postEffects) { this.postEffects = postEffects; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}

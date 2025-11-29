package com.example.demo.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonFormat;


@Entity
@Table(
    name = "children",
    uniqueConstraints = @UniqueConstraint(columnNames = "user_id") // one child per user
)
public class Child {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd/MM/yyyy")
    private LocalDate dob;  

    @Column(nullable = false, length = 20)
    private String gender;

    @Column(length = 255)
    private String disability;   // Learning / intellectual disability

    @Column(length = 255)
    private String medication;

    @Column(name = "created_at", columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    // One parent can only have one child atm might change later
    @OneToOne
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @PrePersist
    public void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    //Getters and Setters

    public Long getId() {
    return id;
}

public void setId(Long id) {
    this.id = id;
}

public String getName() {
    return name;
}

public void setName(String name) {
    this.name = name;
}

public LocalDate getDob() {
    return dob;
}

public void setDob(LocalDate dob) {
    this.dob = dob;
}

public String getGender() {
    return gender;
}

public void setGender(String gender) {
    this.gender = gender;
}

public String getDisability() {
    return disability;
}

public void setDisability(String disability) {
    this.disability = disability;
}

public String getMedication() {
    return medication;
}

public void setMedication(String medication) {
    this.medication = medication;
}

public LocalDateTime getCreatedAt() {
    return createdAt;
}

public void setCreatedAt(LocalDateTime createdAt) {
    this.createdAt = createdAt;
}

public User getUser() {
    return user;
}

public void setUser(User user) {
    this.user = user;
}

}


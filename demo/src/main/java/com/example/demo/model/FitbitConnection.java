package com.example.demo.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "fitbit_connection")
public class FitbitConnection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // this links the Fitbit account to a specific child in my app
    @ManyToOne(optional = false)
    @JoinColumn(name = "child_id")
    private Child child;

    // Fitbit's own user id for this account
    @Column(name = "fitbit_user_id", nullable = false)
    private String fitbitUserId;

    // token I use to call Fitbit's API
    @Column(name = "access_token", nullable = false, length = 2048)
    private String accessToken;

    // token I use to get a new access token when it expires
    @Column(name = "refresh_token", nullable = false, length = 2048)
    private String refreshToken;

    // when the current access token will expire
    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    // last time I successfully synced data from Fitbit
    @Column(name = "last_sync_at")
    private LocalDateTime lastSyncAt;

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

    public String getFitbitUserId() {
        return fitbitUserId;
    }

    public void setFitbitUserId(String fitbitUserId) {
        this.fitbitUserId = fitbitUserId;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;
    }

    public LocalDateTime getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(LocalDateTime expiresAt) {
        this.expiresAt = expiresAt;
    }

    public LocalDateTime getLastSyncAt() {
        return lastSyncAt;
    }

    public void setLastSyncAt(LocalDateTime lastSyncAt) {
        this.lastSyncAt = lastSyncAt;
    }
}

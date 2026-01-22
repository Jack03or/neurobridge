package com.example.demo.repository;

import com.example.demo.model.Child;
import com.example.demo.model.FitbitConnection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FitbitConnectionRepository extends JpaRepository<FitbitConnection, Long> {

    // grab the Fitbit connection for a given child (if they have one)
    Optional<FitbitConnection> findByChild(Child child);
}
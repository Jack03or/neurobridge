package com.example.demo.repository;

import com.example.demo.model.Child;
import com.example.demo.model.FitBitMetrics;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

// this repo lets me read/write Fitbit metric rows in the database
public interface FitBitMetricsRepository extends JpaRepository<FitBitMetrics, Long> {

    // all metrics for a child, newest date first
    List<FitBitMetrics> findByChildOrderByDateDesc(Child child);

    // just the latest metrics row for this child
    Optional<FitBitMetrics> findFirstByChildOrderByDateDesc(Child child);

    // metrics for a specific child on a specific day
    Optional<FitBitMetrics> findByChildAndDate(Child child, LocalDate date);
}

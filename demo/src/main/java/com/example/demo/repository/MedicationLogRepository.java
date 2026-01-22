package com.example.demo.repository;

import com.example.demo.model.Child;
import com.example.demo.model.MedicationLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface MedicationLogRepository extends JpaRepository<MedicationLog, Long> {

    // all medication entries for this child on a specific date
    List<MedicationLog> findByChildAndDate(Child child, LocalDate date);
}

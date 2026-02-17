package com.example.demo.repository;

import com.example.demo.model.Child;
import com.example.demo.model.MedicationLog;
import com.example.demo.model.MedicationSchedule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface MedicationLogRepository extends JpaRepository<MedicationLog, Long> {

    // all medication entries for this child on a specific date
    List<MedicationLog> findByChildAndDate(Child child, LocalDate date);

    // all medication entries for this child (for diary)
    List<MedicationLog> findByChildOrderByDateDesc(Child child);

    // range query (for calendar / month views later)
    List<MedicationLog> findByChildAndDateBetweenOrderByDateDesc(Child child, LocalDate from, LocalDate to);

    Optional<MedicationLog> findByChildAndDateAndSchedule(Child child, LocalDate date, MedicationSchedule schedule);
}

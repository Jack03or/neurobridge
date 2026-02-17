package com.example.demo.repository;

import com.example.demo.model.Child;
import com.example.demo.model.MedicationSchedule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MedicationScheduleRepository extends JpaRepository<MedicationSchedule, Long> {
    List<MedicationSchedule> findByChildAndActiveTrueOrderByCreatedAtAsc(Child child);
}


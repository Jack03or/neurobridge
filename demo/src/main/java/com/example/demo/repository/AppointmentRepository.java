package com.example.demo.repository;

import com.example.demo.model.Appointment;
import com.example.demo.model.Child;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface AppointmentRepository extends JpaRepository<Appointment, Long> {

    List<Appointment> findByChildOrderByStartTimeDesc(Child child);

    Optional<Appointment> findFirstByChildOrderByStartTimeDesc(Child child);

    // for listing appointments in a date range (e.g. for calendar view) **Might need later****
    List<Appointment> findByChildAndStartTimeBetweenOrderByStartTimeAsc(
            Child child, LocalDateTime from, LocalDateTime to
    );
}

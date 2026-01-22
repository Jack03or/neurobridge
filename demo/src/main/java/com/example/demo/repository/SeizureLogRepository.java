package com.example.demo.repository;

import com.example.demo.model.Child;
import com.example.demo.model.SeizureLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface SeizureLogRepository extends JpaRepository<SeizureLog, Long> {

    // all seizures for this child, newest first
    List<SeizureLog> findByChildOrderByTimestampDesc(Child child);

    // just grab the last seizure for "last seizure" on the dashboard
    Optional<SeizureLog> findFirstByChildOrderByTimestampDesc(Child child);

    // find seizures within a time window (useful for "last 7 days" etc.)
    List<SeizureLog> findByChildAndTimestampBetween(
            Child child,
            LocalDateTime start,
            LocalDateTime end
    );
}

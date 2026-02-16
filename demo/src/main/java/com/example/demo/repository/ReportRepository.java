package com.example.demo.repository;

import com.example.demo.model.Child;
import com.example.demo.model.Report;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReportRepository extends JpaRepository<Report, Long> {
    List<Report> findByChildOrderByCreatedAtDesc(Child child);
}

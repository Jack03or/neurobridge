package com.example.demo.repository;

import com.example.demo.model.Child;
import com.example.demo.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChildRepository extends JpaRepository<Child, Long> {
    // This allows us to find children that belong to a specific user
    List<Child> findByUser(User user);
    List<Child> findAllByUserIdOrderByCreatedAtDescIdDesc(Long userId);
    Optional<Child> findByUserId(Long userId);
}

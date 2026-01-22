package com.example.demo.controller;

import com.example.demo.model.Child;
import com.example.demo.model.User;
import com.example.demo.repository.ChildRepository;
import com.example.demo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/child")
@CrossOrigin(origins = "*") // allow access from frontend
public class ChildController {

    @Autowired
    private ChildRepository childRepository;

    @Autowired
    private UserRepository userRepository;

    // Add a new child linked to a parent user by their id
    @PostMapping("/add")
    public String addChild(@RequestBody Child child, @RequestParam Long userId) {
        User parent = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        child.setUser(parent);
        childRepository.save(child);

        return "Child added successfully for user ID: " + userId;
    }

    // Get ALL children for a specific parent (your existing endpoint)
    @GetMapping("/list/{userId}")
    public List<Child> getChildrenByUser(@PathVariable Long userId) {
        User parent = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return childRepository.findByUser(parent);
    }

    // NEW: Get the (single) child for a user – used by the Dashboard
    @GetMapping("/by-user/{userId}")
    public ResponseEntity<?> getChildByUser(@PathVariable Long userId) {
        User parent = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<Child> children = childRepository.findByUser(parent);

        if (children.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body("No child found for user ID: " + userId);
        } else {
            // if you truly enforce one-child-per-user, this will just be index 0
            return ResponseEntity.ok(children.get(0));
        }
    }
}

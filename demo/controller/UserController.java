package com.example.demo.controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;

import com.example.demo.model.User;
import com.example.demo.repository.UserRepository;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*") // allow access from frontend
public class UserController {

    @Autowired
    private UserRepository userRepository;

    // ---------- REGISTER ----------
    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody User user) {
        User savedUser = userRepository.save(user);
        
        return ResponseEntity.ok(savedUser);
    }

    // ---------- LOGIN ----------
    @PostMapping("/login")
    public ResponseEntity<?> loginUser(@RequestBody User loginRequest) {
        User existingUser = userRepository.findByEmail(loginRequest.getEmail());

        if (existingUser == null || 
            !existingUser.getPassword().equals(loginRequest.getPassword())) {

            // 401 with JSON error message
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body("{\"message\":\"Invalid email or password\"}");
        }

        
        return ResponseEntity.ok(existingUser);
    }
}

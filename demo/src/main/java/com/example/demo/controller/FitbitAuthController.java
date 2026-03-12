package com.example.demo.controller;

import com.example.demo.service.FitbitOAuthService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/fitbit")
@CrossOrigin(origins = "*")
public class FitbitAuthController {

    private final FitbitOAuthService fitbitOAuthService;

    public FitbitAuthController(FitbitOAuthService fitbitOAuthService) {
        this.fitbitOAuthService = fitbitOAuthService;
    }

    @GetMapping("/connect/{childId}")
    public ResponseEntity<?> connect(
            @PathVariable Long childId,
            @RequestParam(name = "asJson", defaultValue = "false") boolean asJson
    ) {
        try {
            String authUrl = fitbitOAuthService.buildAuthorizeUrl(childId);
            if (asJson) {
                Map<String, Object> body = new LinkedHashMap<>();
                body.put("childId", childId);
                body.put("authUrl", authUrl);
                return ResponseEntity.ok(body);
            }

            HttpHeaders headers = new HttpHeaders();
            headers.add(HttpHeaders.LOCATION, authUrl);
            return new ResponseEntity<>(headers, HttpStatus.FOUND);
        } catch (IllegalArgumentException | IllegalStateException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    @GetMapping("/callback")
    public ResponseEntity<?> callback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error
    ) {
        try {
            FitbitOAuthService.CallbackResult result = fitbitOAuthService.handleCallback(code, state, error);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("status", "ok");
            body.put("childId", result.childId());
            body.put("fitbitUserId", result.fitbitUserId());
            body.put("expiresInSeconds", result.expiresInSeconds());
            body.put("message", "Fitbit connected and tokens saved.");
            return ResponseEntity.ok(body);
        } catch (IllegalArgumentException ex) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("status", "error");
            body.put("message", ex.getMessage());
            return ResponseEntity.badRequest().body(body);
        }
    }

    @PostMapping("/disconnect/{childId}")
    public ResponseEntity<?> disconnect(@PathVariable Long childId) {
        try {
            boolean removed = fitbitOAuthService.disconnect(childId);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("status", "ok");
            body.put("childId", childId);
            body.put("disconnected", removed);
            return ResponseEntity.ok(body);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }
}

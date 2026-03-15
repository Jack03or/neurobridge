package com.example.demo.service;

import com.example.demo.model.Child;
import com.example.demo.model.FitbitConnection;
import com.example.demo.repository.ChildRepository;
import com.example.demo.repository.FitbitConnectionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class FitbitOAuthService {

    private static final long STATE_TTL_SECONDS = 600;

    private final ChildRepository childRepository;
    private final FitbitConnectionRepository fitbitConnectionRepository;

    @Value("${fitbit.client-id:}")
    private String clientId;

    @Value("${fitbit.redirect-uri:http://localhost:8080/api/fitbit/callback}")
    private String redirectUri;

    @Value("${fitbit.auth-url:https://www.fitbit.com/oauth2/authorize}")
    private String authUrl;

    @Value("${fitbit.token-url:https://api.fitbit.com/oauth2/token}")
    private String tokenUrl;

    @Value("${fitbit.client-secret:}")
    private String clientSecret;

    @Value("${fitbit.scopes:heartrate sleep profile}")
    private String scopes;

    private final SecureRandom secureRandom = new SecureRandom();
    private final Map<String, PendingState> pendingStates = new ConcurrentHashMap<>();
    private final RestTemplate restTemplate = new RestTemplate();

    public FitbitOAuthService(ChildRepository childRepository, FitbitConnectionRepository fitbitConnectionRepository) {
        this.childRepository = childRepository;
        this.fitbitConnectionRepository = fitbitConnectionRepository;
    }

    public String buildAuthorizeUrl(Long childId) {
        if (clientId == null || clientId.isBlank()) {
            throw new IllegalStateException("Fitbit client id is missing");
        }
        Child child = childRepository.findById(childId)
                .orElseThrow(() -> new IllegalArgumentException("Child not found"));

        cleanupExpiredStates();
        String state = generateState();
        pendingStates.put(state, new PendingState(child.getId(), Instant.now().plusSeconds(STATE_TTL_SECONDS)));

        return UriComponentsBuilder.fromHttpUrl(authUrl)
                .queryParam("response_type", "code")
                .queryParam("client_id", clientId)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("scope", scopes)
                .queryParam("state", state)
                .toUriString();
    }

    public CallbackResult handleCallback(String code, String state, String error) {
        if (error != null && !error.isBlank()) {
            throw new IllegalArgumentException("Fitbit auth failed: " + error);
        }
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("Missing authorization code");
        }
        if (state == null || state.isBlank()) {
            throw new IllegalArgumentException("Missing state");
        }

        PendingState pending = pendingStates.remove(state);
        if (pending == null || pending.expiresAt().isBefore(Instant.now())) {
            throw new IllegalArgumentException("Invalid or expired state");
        }

        FitbitTokenResponse token = exchangeCodeForTokens(code);
        saveConnection(pending.childId(), token);
        return new CallbackResult(pending.childId(), token.userId(), token.expiresIn());
    }

    public boolean disconnect(Long childId) {
        Child child = childRepository.findById(childId)
                .orElseThrow(() -> new IllegalArgumentException("Child not found"));
        Optional<FitbitConnection> existing = fitbitConnectionRepository.findByChild(child);
        existing.ifPresent(fitbitConnectionRepository::delete);
        return existing.isPresent();
    }

    public boolean hasConnection(Child child) {
        return fitbitConnectionRepository.findByChild(child).isPresent();
    }

    public String getValidAccessToken(Child child) {
        FitbitConnection connection = fitbitConnectionRepository.findByChild(child)
                .orElseThrow(() -> new IllegalArgumentException("No Fitbit connection for child"));
        if (connection.getExpiresAt() == null || connection.getExpiresAt().isBefore(LocalDateTime.now().plusMinutes(1))) {
            return refreshAccessToken(connection).accessToken();
        }
        return connection.getAccessToken();
    }

    public String refreshAccessTokenForChild(Child child) {
        FitbitConnection connection = fitbitConnectionRepository.findByChild(child)
                .orElseThrow(() -> new IllegalArgumentException("No Fitbit connection for child"));
        return refreshAccessToken(connection).accessToken();
    }

    public void markLastSyncNow(Child child) {
        fitbitConnectionRepository.findByChild(child).ifPresent(connection -> {
            connection.setLastSyncAt(LocalDateTime.now());
            fitbitConnectionRepository.save(connection);
        });
    }

    private void cleanupExpiredStates() {
        Instant now = Instant.now();
        pendingStates.entrySet().removeIf(entry -> entry.getValue().expiresAt().isBefore(now));
    }

    private String generateState() {
        byte[] bytes = new byte[24];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private FitbitTokenResponse exchangeCodeForTokens(String code) {
        if (clientId == null || clientId.isBlank() || clientSecret == null || clientSecret.isBlank()) {
            throw new IllegalStateException("Fitbit client id/secret is missing");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setAccept(java.util.List.of(MediaType.APPLICATION_JSON));
        headers.set("Authorization", basicAuthHeader(clientId, clientSecret));

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", clientId);
        form.add("grant_type", "authorization_code");
        form.add("redirect_uri", redirectUri);
        form.add("code", code);

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(form, headers);
        ResponseEntity<Map> response = restTemplate.exchange(tokenUrl, HttpMethod.POST, request, Map.class);

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new IllegalArgumentException("Failed to exchange authorization code");
        }

        Map body = response.getBody();
        String accessToken = asString(body.get("access_token"));
        String refreshToken = asString(body.get("refresh_token"));
        String userId = asString(body.get("user_id"));
        Integer expiresIn = asInt(body.get("expires_in"));

        if (isBlank(accessToken) || isBlank(refreshToken) || isBlank(userId) || expiresIn == null) {
            throw new IllegalArgumentException("Token response missing required fields");
        }

        return new FitbitTokenResponse(accessToken, refreshToken, userId, expiresIn);
    }

    private FitbitTokenResponse refreshAccessToken(FitbitConnection connection) {
        if (clientId == null || clientId.isBlank() || clientSecret == null || clientSecret.isBlank()) {
            throw new IllegalStateException("Fitbit client id/secret is missing");
        }
        if (connection.getRefreshToken() == null || connection.getRefreshToken().isBlank()) {
            throw new IllegalArgumentException("Missing refresh token");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setAccept(java.util.List.of(MediaType.APPLICATION_JSON));
        headers.set("Authorization", basicAuthHeader(clientId, clientSecret));

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "refresh_token");
        form.add("refresh_token", connection.getRefreshToken());

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(form, headers);
        ResponseEntity<Map> response = restTemplate.exchange(tokenUrl, HttpMethod.POST, request, Map.class);
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new IllegalArgumentException("Failed to refresh Fitbit token");
        }

        Map body = response.getBody();
        String accessToken = asString(body.get("access_token"));
        String refreshToken = asString(body.get("refresh_token"));
        String userId = asString(body.get("user_id"));
        Integer expiresIn = asInt(body.get("expires_in"));

        if (isBlank(accessToken) || isBlank(refreshToken) || expiresIn == null) {
            throw new IllegalArgumentException("Refresh token response missing required fields");
        }

        connection.setAccessToken(accessToken);
        connection.setRefreshToken(refreshToken);
        if (!isBlank(userId)) {
            connection.setFitbitUserId(userId);
        }
        connection.setExpiresAt(LocalDateTime.now().plusSeconds(expiresIn));
        fitbitConnectionRepository.save(connection);

        return new FitbitTokenResponse(accessToken, refreshToken, connection.getFitbitUserId(), expiresIn);
    }

    private void saveConnection(Long childId, FitbitTokenResponse token) {
        Child child = childRepository.findById(childId)
                .orElseThrow(() -> new IllegalArgumentException("Child not found"));

        FitbitConnection connection = fitbitConnectionRepository.findByChild(child).orElseGet(FitbitConnection::new);
        connection.setChild(child);
        connection.setFitbitUserId(token.userId());
        connection.setAccessToken(token.accessToken());
        connection.setRefreshToken(token.refreshToken());
        connection.setExpiresAt(LocalDateTime.now().plusSeconds(token.expiresIn()));
        connection.setLastSyncAt(LocalDateTime.now());
        fitbitConnectionRepository.save(connection);
    }

    private String basicAuthHeader(String id, String secret) {
        String plain = id + ":" + secret;
        String encoded = Base64.getEncoder().encodeToString(plain.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        return "Basic " + encoded;
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private Integer asInt(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception e) {
            return null;
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private record PendingState(Long childId, Instant expiresAt) {}

    private record FitbitTokenResponse(String accessToken, String refreshToken, String userId, Integer expiresIn) {}

    public record CallbackResult(Long childId, String fitbitUserId, Integer expiresInSeconds) {}
}

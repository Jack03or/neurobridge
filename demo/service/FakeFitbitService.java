package com.example.demo.service;

import com.example.demo.model.Child;
import com.example.demo.model.FitBitMetrics;
import com.example.demo.repository.FitBitMetricsRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class FakeFitbitService implements FitbitService {

    @Autowired
    private FitBitMetricsRepository metricsRepository;

    @Override
    public FitBitMetrics getOrCreateTodayMetrics(Child child) {
        LocalDate today = LocalDate.now();

        // if we already generated metrics for today, just reuse them
        Optional<FitBitMetrics> existing = metricsRepository.findByChildAndDate(child, today);
        if (existing.isPresent()) {
            return existing.get();
        }

        // otherwise create a new fake metrics row
        FitBitMetrics metrics = new FitBitMetrics();
        metrics.setChild(child);
        metrics.setDate(today);

        // fake sleep between 6.0 and 9.0 hours
        double sleepHours = randomDouble(6.0, 9.0);
        metrics.setSleepHours(roundOneDecimal(sleepHours));

        // fake heart rate between 70 and 110 bpm
        int heartRate = randomInt(70, 110);
        metrics.setLatestHeartRate(heartRate);
        metrics.setLatestHeartRateAt(LocalDateTime.now().minusMinutes(1));

        // fake HRV between 30 and 80
        double hrv = randomDouble(30.0, 80.0);
        metrics.setHrv(roundOneDecimal(hrv));

        return metricsRepository.save(metrics);
    }

    @Override
    public FitBitMetrics saveMetrics(FitBitMetrics metrics) {
        return metricsRepository.save(metrics);
    }

    private double randomDouble(double min, double max) {
        return ThreadLocalRandom.current().nextDouble(min, max);
    }

    private int randomInt(int min, int max) {
        return ThreadLocalRandom.current().nextInt(min, max + 1);
    }

    private double roundOneDecimal(double value) {
        return Math.round(value * 10.0) / 10.0;
    }
}

package com.example.demo.service;

import com.example.demo.model.Child;
import com.example.demo.model.FitBitMetrics;

public interface FitbitService {

    // get today's metrics for this child.
    // if none exist, generate + save once.
    FitBitMetrics getOrCreateTodayMetrics(Child child);

    // save (used after we write risk values)
    FitBitMetrics saveMetrics(FitBitMetrics metrics);
}

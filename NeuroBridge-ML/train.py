# train.py
import json
from pathlib import Path

import numpy as np
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, roc_auc_score


def sigmoid(x: float) -> float:
    return 1 / (1 + np.exp(-x))


def generate_synthetic_dataset(n: int = 3000, seed: int = 42) -> pd.DataFrame:
    """
    Synthetic daily seizure-risk training data.
    Features are realistic ranges for wearables.
    Target is generated from a "risk score" (not medically perfect, but consistent + demo-friendly).
    """
    rng = np.random.default_rng(seed)

    # Wearable-ish features (same ones you already store in fitbit_metrics)
    sleep_hours = rng.normal(loc=7.5, scale=1.0, size=n).clip(3.0, 11.0)        # 3..11
    heart_rate = rng.normal(loc=85, scale=12, size=n).clip(55, 140).round()     # 55..140
    hrv = rng.normal(loc=55, scale=15, size=n).clip(15, 120)                    # 15..120

    # Optional extra features (you can hook these up later from your DB/logs)
    medication_taken = rng.integers(low=0, high=2, size=n)  # 0/1
    days_since_seizure = rng.integers(low=0, high=60, size=n)  # 0..59

    # Build a synthetic "risk score"
    # Intuition:
    # - Less sleep -> higher risk
    # - Higher HR -> higher risk
    # - Lower HRV -> higher risk
    # - Medication taken -> lower risk
    # - Recent seizure -> higher risk (small effect)
    sleep_penalty = (7.5 - sleep_hours) * 0.9
    hr_penalty = (heart_rate - 85) * 0.04
    hrv_penalty = (55 - hrv) * 0.03
    med_bonus = (1 - medication_taken) * 0.6  # if missed, increase risk
    recent_penalty = np.exp(-days_since_seizure / 10.0) * 0.6

    # Combine + add noise
    score = (
        sleep_penalty
        + hr_penalty
        + hrv_penalty
        + med_bonus
        + recent_penalty
        + rng.normal(0, 0.35, size=n)
    )

    # Convert score to probability via sigmoid
    prob = sigmoid(score)

    # Turn into a binary label (1=risk event day / high risk day)
    # threshold chosen for usable class balance (demo-friendly)
    y = (prob > 0.55).astype(int)

    df = pd.DataFrame(
        {
            "sleep_hours": sleep_hours.round(1),
            "latest_heart_rate": heart_rate.astype(int),
            "hrv": hrv.round(1),
            "medication_taken": medication_taken.astype(int),
            "days_since_seizure": days_since_seizure.astype(int),
            "target": y,
        }
    )
    return df


def main():
    print("Generating synthetic dataset...")
    df = generate_synthetic_dataset(n=3000, seed=42)

    X = df[["sleep_hours", "latest_heart_rate", "hrv", "medication_taken", "days_since_seizure"]]
    y = df["target"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )

    # Pipeline = scaler + logistic regression (classic + explainable + “proper ML”)
    model = Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(max_iter=200, class_weight="balanced", random_state=42)),
        ]
    )

    print("Training Logistic Regression...")
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    acc = float(accuracy_score(y_test, y_pred))
    auc = float(roc_auc_score(y_test, y_prob))

    out_model = Path("model.joblib")
    out_metrics = Path("metrics.json")

    joblib.dump(model, out_model)
    out_metrics.write_text(json.dumps({"accuracy": acc, "auc": auc}, indent=2))

    print(f"Saved model -> {out_model.resolve()}")
    print(f"Saved metrics -> {out_metrics.resolve()}")
    print(f"Accuracy: {acc:.3f} | AUC: {auc:.3f}")


if __name__ == "__main__":
    main()

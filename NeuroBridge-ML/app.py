# app.py 

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
import joblib
import numpy as np
import os
import json
from typing import Optional

from train import refresh_insights_only

app = FastAPI()

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.joblib")
METRICS_PATH = os.path.join(os.path.dirname(__file__), "metrics.json")
INSIGHTS_PATH = os.path.join(os.path.dirname(__file__), "insights.json")
INSIGHTS_BY_CHILD_PATH = os.path.join(os.path.dirname(__file__), "insights_by_child.json")

model = None
model_loaded = False
feature_columns = []

# ---- Request schema for prediction endpoint ----
class PredictRequest(BaseModel):
    sleep_hours: float = Field(..., ge=0, le=24)
    latest_heart_rate: int = Field(..., ge=30, le=220)
    hrv: float = Field(..., ge=0, le=300)
    medication_taken: int = Field(..., ge=0, le=1)  # 0/1
    medication_status: str = Field("missed")
    days_since_seizure: int = Field(..., ge=0, le=3650)

# ---- Startup: load model once ----
@app.on_event("startup")
def load_model():
    global model, model_loaded, feature_columns
    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
        model_loaded = True
        if os.path.exists(METRICS_PATH):
            try:
                with open(METRICS_PATH, "r") as f:
                    metrics = json.load(f)
                feature_columns = metrics.get("feature_columns", []) or []
            except Exception:
                feature_columns = []
        else:
            feature_columns = []
    else:
        model_loaded = False
        feature_columns = []

@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model_loaded, "feature_columns": feature_columns}

@app.get("/insights")
def insights(childId: Optional[int] = Query(default=None)):
    if childId is not None:
        if not os.path.exists(INSIGHTS_BY_CHILD_PATH):
            raise HTTPException(status_code=404, detail="Child insights not found. Train first.")
        try:
            with open(INSIGHTS_BY_CHILD_PATH, "r") as f:
                data = json.load(f)
            by_child = data.get("by_child", {})
            child_data = by_child.get(str(childId))
            if child_data is None:
                return {"child_id": childId, "insights": []}
            child_data["child_id"] = childId
            return child_data
        except Exception:
            raise HTTPException(status_code=500, detail="Failed to load child insights")

    if not os.path.exists(INSIGHTS_PATH):
        raise HTTPException(status_code=404, detail="Insights not found. Train first.")
    try:
        with open(INSIGHTS_PATH, "r") as f:
            return json.load(f)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to load insights")


@app.post("/refresh-insights")
def refresh_insights(childId: Optional[int] = Query(default=None)):
    try:
        refresh_insights_only()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to refresh insights: {exc}")

    if childId is not None:
        if not os.path.exists(INSIGHTS_BY_CHILD_PATH):
            raise HTTPException(status_code=404, detail="Child insights not found after refresh.")
        try:
            with open(INSIGHTS_BY_CHILD_PATH, "r") as f:
                data = json.load(f)
            child_data = data.get("by_child", {}).get(str(childId))
            if child_data is None:
                return {"child_id": childId, "insights": []}
            child_data["child_id"] = childId
            return child_data
        except Exception:
            raise HTTPException(status_code=500, detail="Failed to load refreshed child insights")

    try:
        with open(INSIGHTS_PATH, "r") as f:
            return json.load(f)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to load refreshed insights")

# ---- Helper: clamp to avoid 0%/100% medical-style certainty ----
def safe_probability(p: float) -> float:
    """
    Convert model probability into a safer risk estimate:
    - keep ordering the same, but soften parent-facing percentages
    - clamp to [5%, 95%] so we never claim certainty
    """
    p = float(np.clip(p, 0.0, 1.0))

    # clamp to 5%..95% so we never claim certainty.
    p = float(np.clip(p, 0.05, 0.95))
    return p


def apply_live_medication_adjustment(p: float, medication_status: str, medication_taken: int) -> float:
    p = float(np.clip(p, 0.0, 1.0))
    status = (medication_status or "").strip().lower()
    if status == "taken":
        p -= 0.015
    elif status == "late":
        p += 0.005
    elif status == "missed":
        p += 0.005
    elif medication_taken == 1:
        p -= 0.04
    else:
        p += 0.005
    return float(np.clip(p, 0.0, 1.0))

def risk_level_from_percent(risk_percent: int) -> str:
    # risk levels based on percent thresholds 
    if risk_percent < 35:
        return "LOW"
    elif risk_percent < 65:
        return "MEDIUM"
    elif risk_percent < 100:
        return "HIGH"
    else:
        return "HIGH"


def build_feature_frame(req: PredictRequest):
    sleep_score = max(0.0, (7.5 - req.sleep_hours) * 1.5)
    hrv_score = max(0.0, 55.0 - req.hrv)
    hr_score = max(0.0, req.latest_heart_rate - 85.0)

    status = (req.medication_status or "").strip().lower()
    med_taken = 1 if status in {"taken", "late"} or req.medication_taken == 1 else 0
    med_late = 1 if status == "late" else 0
    med_missed = 1 if status == "missed" or med_taken == 0 else 0
    low_sleep_and_missed = 1 if (req.sleep_hours < 6.0 and med_missed == 1) else 0
    time_since_last_med_hours = 8.0 if med_late == 1 else (0.0 if med_taken == 1 else 24.0)

    values = {
        "sleep_score": sleep_score,
        "hrv_score": hrv_score,
        "hr_score": hr_score,
        "any_missed_med": float(med_missed),
        "any_late_med": float(med_late),
        "low_sleep_and_missed_meds": float(low_sleep_and_missed),
        "time_since_last_med_hours": time_since_last_med_hours,
        "hour_of_day": float(np.datetime64("now").astype(object).hour),
        "day_of_week": float(np.datetime64("today").astype(object).weekday()),
    }

    ordered_columns = feature_columns or list(values.keys())
    row = {column: float(values.get(column, 0.0)) for column in ordered_columns}

    import pandas as pd
    return pd.DataFrame([row], columns=ordered_columns)

@app.post("/predict")
def predict(req: PredictRequest):
    if not model_loaded or model is None:
        raise HTTPException(status_code=503, detail="Model not loaded. Train first.")

    try:
        X = build_feature_frame(req)
        proba = model.predict_proba(X)[0][1]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}")

    proba = apply_live_medication_adjustment(proba, req.medication_status, req.medication_taken)
    p_safe = safe_probability(proba)
    risk_percent = int(round(p_safe * 100))
    level = risk_level_from_percent(risk_percent)

    return {
        "risk_percent": risk_percent,
        "risk_level": level,
        "model_loaded": True,
        # optional for debugging
        "raw_model_probability": float(proba)
    }

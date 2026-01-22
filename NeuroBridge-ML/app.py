# app.py 

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import joblib
import numpy as np
import os
import json

app = FastAPI()

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.joblib")
METRICS_PATH = os.path.join(os.path.dirname(__file__), "metrics.json")

model = None
model_loaded = False

# ---- Request schema (matches what you send from Postman / Java) ----
class PredictRequest(BaseModel):
    sleep_hours: float = Field(..., ge=0, le=24)
    latest_heart_rate: int = Field(..., ge=30, le=220)
    hrv: float = Field(..., ge=0, le=300)
    medication_taken: int = Field(..., ge=0, le=1)  # 0/1
    days_since_seizure: int = Field(..., ge=0, le=3650)

# ---- Startup: load model once ----
@app.on_event("startup")
def load_model():
    global model, model_loaded
    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
        model_loaded = True
    else:
        model_loaded = False

@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model_loaded}

# ---- Helper: clamp + avoid 0%/100% medical-style certainty ----
def safe_probability(p: float) -> float:
    """
    Convert model probability into a safer risk estimate:
    - compress extremes a bit (reduce overconfidence)
    - clamp to [5%, 95%] so we never claim certainty
    """
    p = float(np.clip(p, 0.0, 1.0))

    # confidence compression: pulls very high/low probs towards the center a bit
    # (simple and explainable; helps avoid 0/100 even if model is overconfident)
    p = 0.5 + 0.8 * (p - 0.5)   # 0.8 is "temperature-like" smoothing

    # clamp to 5%..95%
    p = float(np.clip(p, 0.05, 0.95))
    return p

def risk_level_from_percent(risk_percent: int) -> str:
    # simple bands you can justify in a report
    if risk_percent < 20:
        return "LOW"
    elif risk_percent < 50:
        return "MEDIUM"
    elif risk_percent < 80:
        return "HIGH"
    else:
        return "VERY_HIGH"

@app.post("/predict")
def predict(req: PredictRequest):
    if not model_loaded or model is None:
        raise HTTPException(status_code=503, detail="Model not loaded. Train first.")

    # feature order must match training
    X = np.array([[
        req.sleep_hours,
        req.latest_heart_rate,
        req.hrv,
        req.medication_taken,
        req.days_since_seizure
    ]], dtype=float)

    # probability of class 1 (seizure risk event)
    proba = model.predict_proba(X)[0][1]

    p_safe = safe_probability(proba)
    risk_percent = int(round(p_safe * 100))
    level = risk_level_from_percent(risk_percent)

    return {
        "risk_percent": risk_percent,
        "risk_level": level,
        "model_loaded": True,
        # optional for debugging/reporting (you can remove later)
        "raw_model_probability": float(proba)
    }

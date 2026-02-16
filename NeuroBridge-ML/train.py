# train.py
import json
import os
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

import mysql.connector

from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

from xgboost import XGBClassifier


DB_DEFAULTS = {
    "host": "127.0.0.1",
    "port": "3306",
    "name": "neurobridge",
}


def get_db_config() -> dict:
    host = os.getenv("DB_HOST", DB_DEFAULTS["host"])
    port = int(os.getenv("DB_PORT", DB_DEFAULTS["port"]))
    name = os.getenv("DB_NAME", DB_DEFAULTS["name"])
    user = os.getenv("DB_USER")
    password = os.getenv("DB_PASSWORD")

    if not user or not password:
        raise RuntimeError(
            "Missing DB credentials. Set DB_USER and DB_PASSWORD (and optionally DB_HOST/DB_PORT/DB_NAME)."
        )

    return {
        "host": host,
        "port": port,
        "database": name,
        "user": user,
        "password": password,
    }


def read_sql(query: str) -> pd.DataFrame:
    cfg = get_db_config()
    conn = mysql.connector.connect(**cfg)
    try:
        return pd.read_sql(query, conn)
    finally:
        conn.close()


def coerce_bit(value) -> int:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return np.nan
    if isinstance(value, (bytes, bytearray)) and len(value) > 0:
        return int(value[0])
    if isinstance(value, (bool, np.bool_)):
        return int(value)
    if isinstance(value, (int, np.integer)):
        return int(value)
    try:
        return int(value)
    except Exception:
        return np.nan


def load_tables() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    seizure_df = read_sql(
        """
        SELECT id, child_id, timestamp
        FROM seizure_log
        WHERE timestamp IS NOT NULL
        """
    )
    meds_df = read_sql(
        """
        SELECT child_id, date, taken, taken_at
        FROM medication_log
        WHERE date IS NOT NULL
        """
    )
    fitbit_df = read_sql(
        """
        SELECT child_id, date, sleep_hours, hrv, latest_heart_rate,
               latest_heart_rate_at, created_at
        FROM fitbit_metrics
        WHERE date IS NOT NULL
        """
    )

    seizure_df["timestamp"] = pd.to_datetime(seizure_df["timestamp"])
    seizure_df["date"] = seizure_df["timestamp"].dt.date

    meds_df["date"] = pd.to_datetime(meds_df["date"]).dt.date
    meds_df["taken"] = meds_df["taken"].apply(coerce_bit)
    meds_df["taken_at"] = pd.to_datetime(meds_df["taken_at"])

    fitbit_df["date"] = pd.to_datetime(fitbit_df["date"]).dt.date
    fitbit_df["latest_heart_rate_at"] = pd.to_datetime(fitbit_df["latest_heart_rate_at"])
    fitbit_df["created_at"] = pd.to_datetime(fitbit_df["created_at"])

    return seizure_df, meds_df, fitbit_df


def build_meds_daily(meds_df: pd.DataFrame) -> pd.DataFrame:
    if meds_df.empty:
        return pd.DataFrame(
            columns=[
                "child_id",
                "date",
                "med_taken_today",
                "med_missed_today",
                "med_logged_today",
                "last_taken_at",
            ]
        )

    meds_daily = (
        meds_df.groupby(["child_id", "date"])
        .agg(
            med_taken_today=("taken", "max"),
            med_missed_today=("taken", lambda x: int((x == 0).any())),
            med_logged_today=("taken", "size"),
        )
        .reset_index()
    )
    meds_daily["med_logged_today"] = (meds_daily["med_logged_today"] > 0).astype(int)

    meds_taken = meds_df[(meds_df["taken"] == 1) & meds_df["taken_at"].notna()].copy()
    last_taken_daily = (
        meds_taken.groupby(["child_id", "date"])["taken_at"].max().reset_index()
    )
    last_taken_daily = last_taken_daily.rename(columns={"taken_at": "last_taken_at"})

    meds_daily = meds_daily.merge(last_taken_daily, on=["child_id", "date"], how="left")
    return meds_daily


def add_time_since_last_med(events_df: pd.DataFrame, meds_df: pd.DataFrame) -> pd.DataFrame:
    meds_taken = meds_df[(meds_df["taken"] == 1) & meds_df["taken_at"].notna()].copy()
    if meds_taken.empty:
        events_df["time_since_last_med_hours"] = np.nan
        return events_df

    events = events_df.copy()
    events["time_since_last_med_hours"] = np.nan

    meds_taken["taken_at"] = pd.to_datetime(meds_taken["taken_at"])

    for child_id, child_events in events.groupby("child_id"):
        child_meds = meds_taken[meds_taken["child_id"] == child_id]["taken_at"].sort_values()
        if child_meds.empty:
            continue

        med_times = child_meds.to_numpy()
        event_times = pd.to_datetime(child_events["timestamp"]).to_numpy()

        idx = np.searchsorted(med_times, event_times, side="right") - 1
        valid = idx >= 0

        deltas = np.full(len(event_times), np.nan, dtype=float)
        deltas[valid] = (event_times[valid] - med_times[idx[valid]]) / np.timedelta64(1, "h")

        events.loc[child_events.index, "time_since_last_med_hours"] = deltas

    return events


def choose_negative_timestamp(row: pd.Series) -> pd.Timestamp:
    if pd.notna(row.get("latest_heart_rate_at")):
        return row["latest_heart_rate_at"]
    if pd.notna(row.get("created_at")):
        return row["created_at"]
    return pd.Timestamp(row["date"]) + pd.Timedelta(hours=12)


def build_feature_rows(
    seizure_df: pd.DataFrame, meds_df: pd.DataFrame, fitbit_df: pd.DataFrame
) -> pd.DataFrame:
    meds_daily = build_meds_daily(meds_df)

    seizures = (
        seizure_df.merge(fitbit_df, on=["child_id", "date"], how="left")
        .merge(meds_daily, on=["child_id", "date"], how="left")
        .copy()
    )
    seizures["label"] = 1

    seizure_days = seizure_df[["child_id", "date"]].drop_duplicates()
    neg = (
        fitbit_df.merge(seizure_days, on=["child_id", "date"], how="left", indicator=True)
        .query("_merge == 'left_only'")
        .drop(columns=["_merge"])
        .copy()
    )
    if not neg.empty:
        neg["timestamp"] = neg.apply(choose_negative_timestamp, axis=1)
        neg = neg.merge(meds_daily, on=["child_id", "date"], how="left")
        neg["label"] = 0

    events = pd.concat([seizures, neg], ignore_index=True, sort=False)
    events["timestamp"] = pd.to_datetime(events["timestamp"])

    events = add_time_since_last_med(events, meds_df)

    events["hour_of_day"] = events["timestamp"].dt.hour
    events["day_of_week"] = events["timestamp"].dt.dayofweek

    events["sleep_score"] = (7.5 - events["sleep_hours"]).clip(lower=0) * 1.5
    events["hrv_score"] = (55 - events["hrv"]).clip(lower=0)
    events["hr_score"] = (events["latest_heart_rate"] - 85).clip(lower=0)

    for col in ["med_taken_today", "med_missed_today", "med_logged_today"]:
        if col not in events:
            events[col] = np.nan
        events[col] = events[col].fillna(0).astype(int)

    return events


def train_model(events: pd.DataFrame, out_model: Path, out_metrics: Path) -> None:
    feature_cols = [
        "sleep_score",
        "hrv_score",
        "hr_score",
        "med_missed_today",
        "med_taken_today",
        "med_logged_today",
        "time_since_last_med_hours",
        "hour_of_day",
        "day_of_week",
    ]

    if events.empty:
        raise RuntimeError("No data available to train on.")

    X = events[feature_cols]
    y = events["label"].astype(int)

    pos = int(y.sum())
    neg = int((y == 0).sum())
    if pos < 2 or neg < 2:
        raise RuntimeError(
            f"Not enough data to train. Need >=2 positives and >=2 negatives (got pos={pos}, neg={neg})."
        )

    scale_pos_weight = neg / max(pos, 1)

    monotone_constraints = (1, 1, 1, 1, -1, 0, 1, 0, 0)

    model = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            (
                "clf",
                XGBClassifier(
                    n_estimators=300,
                    max_depth=4,
                    learning_rate=0.08,
                    subsample=0.9,
                    colsample_bytree=0.9,
                    eval_metric="logloss",
                    random_state=42,
                    scale_pos_weight=scale_pos_weight,
                    monotone_constraints=monotone_constraints,
                    n_jobs=2,
                ),
            ),
        ]
    )

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )

    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_test, y_prob)),
        "positives": pos,
        "negatives": neg,
        "feature_columns": feature_cols,
        "scale_pos_weight": float(scale_pos_weight),
        "model": "xgboost",
    }

    joblib.dump(model, out_model)
    out_metrics.write_text(json.dumps(metrics, indent=2))


def compute_insights(events: pd.DataFrame) -> dict:
    insights = []

    total = int(len(events))
    total_seizures = int(events["label"].sum())
    total_non = total - total_seizures

    def rate(label_df: pd.DataFrame, condition: pd.Series) -> float:
        denom = max(len(label_df), 1)
        return float(condition.sum() / denom)

    seizures = events[events["label"] == 1]
    non = events[events["label"] == 0]

    missed_meds_rate_seiz = rate(seizures, seizures["med_missed_today"] == 1)
    missed_meds_rate_non = rate(non, non["med_missed_today"] == 1)

    low_sleep_thresh = 6.0
    low_sleep_seiz = rate(seizures, seizures["sleep_hours"] < low_sleep_thresh)
    low_sleep_non = rate(non, non["sleep_hours"] < low_sleep_thresh)

    if total_seizures > 0:
        if missed_meds_rate_seiz > missed_meds_rate_non + 0.1:
            insights.append(
                "Seizures were more common on days with missed medication."
            )
        if low_sleep_seiz > low_sleep_non + 0.1:
            insights.append(
                "Seizures were more common on days with low sleep (<6h)."
            )

        combined_seiz = rate(
            seizures,
            (seizures["med_missed_today"] == 1) & (seizures["sleep_hours"] < low_sleep_thresh),
        )
        if combined_seiz > 0.2:
            insights.append(
                "Missed medication plus low sleep showed up together on seizure days."
            )

        hour_bins = pd.cut(
            seizures["hour_of_day"],
            bins=[-1, 5, 11, 17, 23],
            labels=["Night", "Morning", "Afternoon", "Evening"],
        )
        top_time = hour_bins.value_counts().idxmax()
        insights.append(f"Most seizures happened in the {top_time} time window.")

        day_bins = seizures["day_of_week"].map(
            {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}
        )
        top_day = day_bins.value_counts().idxmax()
        insights.append(f"Seizures were most common on {top_day}.")

        seizure_dates = (
            seizures["timestamp"]
            .dropna()
            .dt.date.drop_duplicates()
            .sort_values()
            .to_list()
        )
        streak = 1
        longest = 1
        for i in range(1, len(seizure_dates)):
            if (seizure_dates[i] - seizure_dates[i - 1]).days == 1:
                streak += 1
                longest = max(longest, streak)
            else:
                streak = 1
        if longest >= 2:
            insights.append(f"There was a streak of {longest} consecutive seizure day(s).")

    summary = {
        "total_rows": total,
        "total_seizures": total_seizures,
        "total_non_seizure": total_non,
        "missed_meds_rate_seizure": missed_meds_rate_seiz,
        "missed_meds_rate_non_seizure": missed_meds_rate_non,
        "low_sleep_rate_seizure": low_sleep_seiz,
        "low_sleep_rate_non_seizure": low_sleep_non,
        "insights": insights,
    }
    return summary


def main() -> None:
    print("Loading data from MySQL...")
    seizure_df, meds_df, fitbit_df = load_tables()

    print("Building feature rows...")
    events = build_feature_rows(seizure_df, meds_df, fitbit_df)

    out_model = Path("model.joblib")
    out_metrics = Path("metrics.json")
    out_insights = Path("insights.json")

    print("Training model...")
    train_model(events, out_model, out_metrics)
    out_insights.write_text(json.dumps(compute_insights(events), indent=2))

    print(f"Saved model -> {out_model.resolve()}")
    print(f"Saved metrics -> {out_metrics.resolve()}")
    print(f"Saved insights -> {out_insights.resolve()}")


if __name__ == "__main__":
    main()

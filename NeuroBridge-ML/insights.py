import numpy as np
import pandas as pd


DAY_LABELS = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}
TIME_LABELS = ["Night", "Morning", "Afternoon", "Evening"]
LOW_SLEEP_THRESHOLD = 6.0


def rate(label_df: pd.DataFrame, condition: pd.Series) -> float:
    denom = max(len(label_df), 1)
    return float(condition.sum() / denom)


def unique_keep_order(items: list[str]) -> list[str]:
    seen = set()
    out = []
    for item in items:
        if not item or item in seen:
            continue
        seen.add(item)
        out.append(item)
    return out


def add_message(bucket: list[dict], text: str, severity: str) -> None:
    if text:
        bucket.append({"text": text, "severity": severity})


def message_topic(text: str) -> str:
    lower = text.lower()
    if "poor sleep and" in lower:
        return "sleep_combo_current" if "today" in lower else "sleep_combo_history"
    if "poor sleep" in lower:
        if "has lasted" in lower:
            return "sleep_current"
        return "sleep_history"
    if "medication" in lower or "dose" in lower:
        return "medication_current" if "today" in lower or "recently" in lower else "medication_history"
    if "stress" in lower:
        return "stress_current" if "today" in lower else "stress_history"
    if "heart rate" in lower:
        return "heart_current" if "last update" in lower else "heart_history"
    if "time window" in lower or "time when seizures" in lower:
        return "timing"
    if "most often on" in lower:
        return "weekday"
    if "run of" in lower:
        return "streak"
    return text


def summarize_bucket(messages: list[dict], fallback: str) -> dict:
    unique = []
    seen = set()
    seen_topics = set()
    for item in messages:
        text = item["text"]
        topic = message_topic(text)
        if text in seen:
            continue
        if topic in seen_topics:
            continue
        seen.add(text)
        seen_topics.add(topic)
        unique.append(item)

    if not unique:
        return {"status": "good", "messages": [fallback]}

    severity_scores = {"high": 2, "medium": 1, "low": 0}
    score = sum(severity_scores.get(item["severity"], 0) for item in unique)
    if score >= 3:
        status = "alert"
    elif score >= 1:
        status = "watch"
    else:
        status = "good"

    if status == "good":
        low_priority = [item["text"] for item in unique if item["severity"] == "low"]
        output_messages = [fallback]
        if low_priority:
            output_messages.append(low_priority[0])
    else:
        output_messages = [item["text"] for item in unique[:5]]
    return {"status": status, "messages": output_messages[:5]}


def build_daily_events(events: pd.DataFrame) -> pd.DataFrame:
    if events.empty:
        return pd.DataFrame()

    daily = events.copy()
    daily["date"] = pd.to_datetime(daily["timestamp"]).dt.date

    daily = (
        daily.groupby("date", as_index=False)
        .agg(
            label=("label", "max"),
            sleep_hours=("sleep_hours", "mean"),
            any_missed_med=("any_missed_med", "max"),
            any_late_med=("any_late_med", "max"),
            latest_heart_rate=("latest_heart_rate", "mean"),
            hrv=("hrv", "mean"),
            day_of_week=("day_of_week", "first"),
            hour_of_day=("hour_of_day", "first"),
        )
        .sort_values("date")
        .reset_index(drop=True)
    )

    daily["sleep_hours"] = pd.to_numeric(daily["sleep_hours"], errors="coerce")
    daily["latest_heart_rate"] = pd.to_numeric(daily["latest_heart_rate"], errors="coerce")
    daily["hrv"] = pd.to_numeric(daily["hrv"], errors="coerce")
    daily["any_missed_med"] = daily["any_missed_med"].fillna(0).astype(int)
    daily["any_late_med"] = daily["any_late_med"].fillna(0).astype(int)
    daily["low_sleep"] = (daily["sleep_hours"] < LOW_SLEEP_THRESHOLD).fillna(False)
    daily["low_sleep_and_missed"] = (
        (daily["low_sleep"]) & (daily["any_missed_med"] == 1)
    ).astype(int)

    streak = 0
    streaks = []
    for is_low in daily["low_sleep"].tolist():
        streak = streak + 1 if is_low else 0
        streaks.append(streak)
    daily["low_sleep_streak"] = streaks

    return daily


def safe_baseline(series: pd.Series) -> float | None:
    valid = pd.to_numeric(series, errors="coerce").dropna()
    if len(valid) < 4:
        return None
    return float(valid.median())


def low_hrv_flag(series: pd.Series, baseline: float | None) -> pd.Series:
    if baseline is None:
        return pd.Series(False, index=series.index)
    cutoff = baseline - max(5.0, baseline * 0.12)
    return series < cutoff


def high_hr_flag(series: pd.Series, baseline: float | None) -> pd.Series:
    if baseline is None:
        return pd.Series(False, index=series.index)
    cutoff = baseline + max(8.0, baseline * 0.10)
    return series > cutoff


def longest_seizure_streak(seizure_dates: list) -> int:
    if not seizure_dates:
        return 0

    streak = 1
    longest = 1
    for i in range(1, len(seizure_dates)):
        if (seizure_dates[i] - seizure_dates[i - 1]).days == 1:
            streak += 1
            longest = max(longest, streak)
        else:
            streak = 1
    return longest


def build_sleep_insights(
    seizure_days: pd.DataFrame,
    non_days: pd.DataFrame,
    low_sleep_seiz: float,
    low_sleep_non: float,
    low_sleep_streak_seiz: float,
    low_sleep_streak_non: float,
    current_low_sleep_streak: int,
) -> dict:
    messages = []
    current_status = "watch" if current_low_sleep_streak >= 1 else "good"

    if current_low_sleep_streak == 1:
        add_message(
            messages,
            "Sleep was lower than usual today. Keep an eye on patterns.",
            "medium",
        )

    if (
        current_low_sleep_streak >= 2
        and len(seizure_days) >= 2
        and low_sleep_streak_seiz > low_sleep_streak_non + 0.15
    ):
        add_message(
            messages,
            f"Poor sleep has lasted {current_low_sleep_streak} nights in a row. This pattern has happened before seizure days.",
            "high",
        )
        current_status = "alert"

    if low_sleep_seiz > low_sleep_non + 0.1:
        add_message(
            messages,
            "In the past, poor sleep has been linked with seizure days.",
            "low",
        )

    if low_sleep_streak_seiz > low_sleep_streak_non + 0.12:
        add_message(
            messages,
            "In the past, several poor-sleep nights in a row have been linked with seizure days.",
            "low",
        )

    summary = summarize_bucket(messages, "Sleep looks stable today.")
    if current_status == "watch" and summary["status"] == "good":
        summary["status"] = "watch"
    if current_status == "alert":
        summary["status"] = "alert"
    return summary


def build_medication_insights(
    latest_day: pd.Series | None,
    missed_meds_rate_seiz: float,
    missed_meds_rate_non: float,
    late_meds_rate_seiz: float,
    late_meds_rate_non: float,
    combined_days_seiz: float,
    combined_days_non: float,
) -> dict:
    messages = []
    current_status = "good"

    if latest_day is not None and latest_day["any_missed_med"] == 1 and missed_meds_rate_seiz > missed_meds_rate_non + 0.10:
        add_message(
            messages,
            "Today's medication was missed. Seizure risk has been higher when doses are skipped.",
            "high",
        )
        current_status = "alert"

    if latest_day is not None and latest_day["low_sleep_and_missed"] == 1 and combined_days_seiz > combined_days_non + 0.10:
        add_message(
            messages,
            "Poor sleep and a missed dose are happening together today. This combination has happened before seizure days. Consider extra monitoring.",
            "high",
        )
        current_status = "alert"

    if latest_day is not None and latest_day["any_late_med"] == 1:
        add_message(
            messages,
            "Medication was taken late today. Try to stay close to the usual time.",
            "medium",
        )
        if current_status != "alert":
            current_status = "watch"

    if missed_meds_rate_seiz > missed_meds_rate_non + 0.1:
        add_message(
            messages,
            "In the past, missed medication has been linked with seizure days.",
            "low",
        )

    if combined_days_seiz > combined_days_non + 0.1:
        add_message(
            messages,
            "In the past, poor sleep and missed medication together have been linked with seizure days.",
            "low",
        )

    if late_meds_rate_seiz > late_meds_rate_non + 0.1:
        add_message(
            messages,
            "In the past, late medication has sometimes been linked with seizure days.",
            "low",
        )

    summary = summarize_bucket(messages, "Medication has been on track today.")
    if current_status == "watch" and summary["status"] == "good":
        summary["status"] = "watch"
    if current_status == "alert":
        summary["status"] = "alert"
    return summary


def build_body_signal_insights(
    latest_low_hrv: bool,
    latest_high_hr: bool,
    low_hrv_rate_seiz: float,
    low_hrv_rate_non: float,
    high_hr_rate_seiz: float,
    high_hr_rate_non: float,
) -> dict:
    messages = []

    if latest_low_hrv and low_hrv_rate_seiz > low_hrv_rate_non + 0.12:
        add_message(
            messages,
            "Stress levels are higher than usual today. Similar changes have happened before seizure days.",
            "high",
        )

    if latest_high_hr and high_hr_rate_seiz > high_hr_rate_non + 0.12:
        add_message(
            messages,
            "Heart rate was higher than normal at the last update. Similar changes have happened before seizure days.",
            "high",
        )

    if low_hrv_rate_seiz > low_hrv_rate_non + 0.12:
        add_message(
            messages,
            "In the past, higher stress has been seen before seizure days.",
            "low",
        )

    if high_hr_rate_seiz > high_hr_rate_non + 0.12:
        add_message(
            messages,
            "In the past, a higher heart rate has been seen before seizure days.",
            "low",
        )

    return summarize_bucket(messages, "Body signals look steady right now.")


def build_seizure_pattern_insights(
    seizures: pd.DataFrame,
    latest_day: pd.Series | None,
    seizure_dates: list,
    combined_days_seiz: float,
    combined_days_non: float,
    low_sleep_streak_seiz: float,
    low_sleep_streak_non: float,
) -> dict:
    messages = []

    if seizures.empty:
        return summarize_bucket(messages, "No seizure pattern needs extra attention right now.")

    if combined_days_seiz > combined_days_non + 0.1:
        add_message(
            messages,
            "Recent seizure periods have often followed poor sleep and missed medication together.",
            "medium",
        )

    if low_sleep_streak_seiz > low_sleep_streak_non + 0.12:
        add_message(
            messages,
            "Recent seizure periods have often followed several poor-sleep nights in a row.",
            "medium",
        )

    hour_bins = pd.cut(
        seizures["hour_of_day"],
        bins=[-1, 5, 11, 17, 23],
        labels=TIME_LABELS,
    )
    top_time = hour_bins.value_counts().idxmax()
    top_time_text = str(top_time).lower()

    if latest_day is not None and latest_day["day_of_week"] in DAY_LABELS:
        current_window = TIME_LABELS[min(3, max(0, int(latest_day["hour_of_day"] // 6)))] if pd.notna(latest_day["hour_of_day"]) else None
        if current_window == top_time:
            add_message(
                messages,
                f"This is a time when seizures have happened more often before: {top_time_text}.",
                "medium",
            )

    longest = longest_seizure_streak(seizure_dates)
    if longest >= 2:
        severity = "medium" if longest >= 4 else "low"
        add_message(
            messages,
            f"There was a run of {longest} seizure days in a row.",
            severity,
        )

    add_message(
        messages,
        f"Seizures have happened most often in the {top_time_text} time window.",
        "low",
    )

    day_bins = seizures["day_of_week"].map(DAY_LABELS)
    top_day = day_bins.value_counts().idxmax()
    add_message(
        messages,
        f"Seizures have happened most often on {top_day}.",
        "low",
    )

    return summarize_bucket(messages, "No strong seizure pattern needs extra attention right now.")


def flatten_categories(categories: dict) -> list[str]:
    flattened = []
    for key in ["sleep", "medication", "bodySignals", "seizurePatterns"]:
        flattened.extend(categories[key]["messages"])
    return unique_keep_order(flattened)[:6]


def compute_insights(events: pd.DataFrame) -> dict:
    total = int(len(events))
    total_seizures = int(events["label"].sum())
    total_non = total - total_seizures

    seizures = events[events["label"] == 1].copy()
    non = events[events["label"] == 0].copy()
    daily = build_daily_events(events)
    seizure_days = daily[daily["label"] == 1].copy()
    non_days = daily[daily["label"] == 0].copy()
    latest_day = daily.iloc[-1] if not daily.empty else None

    missed_meds_rate_seiz = rate(seizures, seizures["any_missed_med"] == 1)
    missed_meds_rate_non = rate(non, non["any_missed_med"] == 1)
    late_meds_rate_seiz = rate(seizures, seizures["any_late_med"] == 1)
    late_meds_rate_non = rate(non, non["any_late_med"] == 1)
    low_sleep_seiz = rate(seizures, seizures["sleep_hours"] < LOW_SLEEP_THRESHOLD)
    low_sleep_non = rate(non, non["sleep_hours"] < LOW_SLEEP_THRESHOLD)

    low_sleep_streak_seiz = rate(seizure_days, seizure_days["low_sleep_streak"] >= 2)
    low_sleep_streak_non = rate(non_days, non_days["low_sleep_streak"] >= 2)
    current_low_sleep_streak = int(latest_day["low_sleep_streak"]) if latest_day is not None else 0

    combined_days_seiz = rate(seizure_days, seizure_days["low_sleep_and_missed"] == 1)
    combined_days_non = rate(non_days, non_days["low_sleep_and_missed"] == 1)

    hrv_baseline = safe_baseline(daily["hrv"]) if not daily.empty else None
    hr_baseline = safe_baseline(daily["latest_heart_rate"]) if not daily.empty else None

    seizure_days["low_hrv"] = low_hrv_flag(seizure_days["hrv"], hrv_baseline)
    non_days["low_hrv"] = low_hrv_flag(non_days["hrv"], hrv_baseline)
    seizure_days["high_hr"] = high_hr_flag(seizure_days["latest_heart_rate"], hr_baseline)
    non_days["high_hr"] = high_hr_flag(non_days["latest_heart_rate"], hr_baseline)

    low_hrv_rate_seiz = rate(seizure_days, seizure_days["low_hrv"] == 1)
    low_hrv_rate_non = rate(non_days, non_days["low_hrv"] == 1)
    high_hr_rate_seiz = rate(seizure_days, seizure_days["high_hr"] == 1)
    high_hr_rate_non = rate(non_days, non_days["high_hr"] == 1)

    latest_low_hrv = bool(low_hrv_flag(pd.Series([latest_day["hrv"]]), hrv_baseline).iloc[0]) if latest_day is not None else False
    latest_high_hr = bool(high_hr_flag(pd.Series([latest_day["latest_heart_rate"]]), hr_baseline).iloc[0]) if latest_day is not None else False

    seizure_dates = (
        seizures["timestamp"]
        .dropna()
        .dt.date.drop_duplicates()
        .sort_values()
        .to_list()
    )

    categories = {
        "sleep": build_sleep_insights(
            seizure_days,
            non_days,
            low_sleep_seiz,
            low_sleep_non,
            low_sleep_streak_seiz,
            low_sleep_streak_non,
            current_low_sleep_streak,
        ),
        "medication": build_medication_insights(
            latest_day,
            missed_meds_rate_seiz,
            missed_meds_rate_non,
            late_meds_rate_seiz,
            late_meds_rate_non,
            combined_days_seiz,
            combined_days_non,
        ),
        "bodySignals": build_body_signal_insights(
            latest_low_hrv,
            latest_high_hr,
            low_hrv_rate_seiz,
            low_hrv_rate_non,
            high_hr_rate_seiz,
            high_hr_rate_non,
        ),
        "seizurePatterns": build_seizure_pattern_insights(
            seizures,
            latest_day,
            seizure_dates,
            combined_days_seiz,
            combined_days_non,
            low_sleep_streak_seiz,
            low_sleep_streak_non,
        ),
    }

    summary = {
        "total_rows": total,
        "total_seizures": total_seizures,
        "total_non_seizure": total_non,
        "missed_meds_rate_seizure": missed_meds_rate_seiz,
        "missed_meds_rate_non_seizure": missed_meds_rate_non,
        "late_meds_rate_seizure": late_meds_rate_seiz,
        "late_meds_rate_non_seizure": late_meds_rate_non,
        "low_sleep_rate_seizure": low_sleep_seiz,
        "low_sleep_rate_non_seizure": low_sleep_non,
        "categories": categories,
        "insights": flatten_categories(categories),
    }
    return summary


def compute_insights_by_child(events: pd.DataFrame) -> dict:
    by_child = {}
    if events.empty:
        return {"by_child": by_child}

    for child_id, child_events in events.groupby("child_id"):
        if pd.isna(child_id):
            continue
        by_child[str(int(child_id))] = compute_insights(child_events.copy())

    return {"by_child": by_child}

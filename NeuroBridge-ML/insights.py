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


def time_window_from_hour(hour: float) -> str:
    if pd.isna(hour):
        return "Daytime"
    hour = int(hour)
    if hour <= 5:
        return "Night"
    if hour <= 11:
        return "Morning"
    if hour <= 17:
        return "Afternoon"
    return "Evening"


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


def compute_insights(events: pd.DataFrame) -> dict:
    insights = []

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

    if total_seizures > 0:
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

        if (
            current_low_sleep_streak >= 2
            and len(seizure_days) >= 2
            and low_sleep_streak_seiz > low_sleep_streak_non + 0.15
        ):
            insights.append(
                f"Sleep has been low for {current_low_sleep_streak} nights in a row. Similar low-sleep streaks appeared before previous seizure days."
            )

        if latest_day is not None and latest_day["any_missed_med"] == 1 and missed_meds_rate_seiz > missed_meds_rate_non + 0.10:
            insights.append(
                "Medication was missed today. Missed medication has appeared before previous seizure days."
            )

        if latest_day is not None and latest_day["low_sleep_and_missed"] == 1 and combined_days_seiz > combined_days_non + 0.10:
            insights.append(
                "Low sleep and missed medication are happening together again. That combination has appeared on previous seizure days."
            )

        if latest_day is not None and latest_day["any_late_med"] == 1 and late_meds_rate_seiz > late_meds_rate_non + 0.10:
            insights.append(
                "Medication has been taken late recently. Late doses were seen before previous seizure days."
            )

        if latest_low_hrv and low_hrv_rate_seiz > low_hrv_rate_non + 0.12:
            insights.append(
                "HRV is lower than this child's usual level. Lower HRV showed up before previous seizure days."
            )

        if latest_high_hr and high_hr_rate_seiz > high_hr_rate_non + 0.12:
            insights.append(
                "Heart rate is higher than this child's usual level. Similar increases were seen before previous seizure days."
            )

        if missed_meds_rate_seiz > missed_meds_rate_non + 0.1:
            insights.append("Seizures were more common on days with missed medication.")

        if low_sleep_seiz > low_sleep_non + 0.1:
            insights.append("Seizures were more common on days with low sleep (<6h).")

        if combined_days_seiz > combined_days_non + 0.1:
            insights.append("Low sleep and missed medication showed up together more often on seizure days.")

        if late_meds_rate_seiz > late_meds_rate_non + 0.1:
            insights.append("Late medication was more common on seizure days.")

        if low_sleep_streak_seiz > low_sleep_streak_non + 0.12:
            insights.append("Seizures were more common after 2 or more nights of low sleep in a row.")

        if low_hrv_rate_seiz > low_hrv_rate_non + 0.12:
            insights.append("Lower HRV appeared more often before seizure days.")

        if high_hr_rate_seiz > high_hr_rate_non + 0.12:
            insights.append("Higher heart rate appeared more often before seizure days.")

        hour_bins = pd.cut(
            seizures["hour_of_day"],
            bins=[-1, 5, 11, 17, 23],
            labels=TIME_LABELS,
        )
        top_time = hour_bins.value_counts().idxmax()
        insights.append(f"Most seizures happened in the {top_time} time window.")

        day_bins = seizures["day_of_week"].map(DAY_LABELS)
        top_day = day_bins.value_counts().idxmax()
        insights.append(f"Seizures were most common on {top_day}.")

        seizure_dates = (
            seizures["timestamp"]
            .dropna()
            .dt.date.drop_duplicates()
            .sort_values()
            .to_list()
        )
        longest = longest_seizure_streak(seizure_dates)
        if longest >= 2:
            insights.append(f"There was a streak of {longest} consecutive seizure day(s).")

    insights = unique_keep_order(insights)[:6]

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
        "insights": insights,
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

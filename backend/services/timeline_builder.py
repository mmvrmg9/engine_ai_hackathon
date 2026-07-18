"""Merges a patient's daily symptom logs and wearable logs into one
chronological timeline. Pure data-shaping -- no pattern logic lives here."""

from __future__ import annotations

from models import Patient, TimelineEntry


def build_timeline(patient: Patient) -> list[TimelineEntry]:
    by_date: dict = {}

    for log in patient.daily_logs:
        by_date[log.date] = TimelineEntry(
            date=log.date,
            cycle_day=log.cycle_day,
            pain_score=log.pain_score,
            pain_location=log.pain_location,
            pain_type=log.pain_type,
            bleeding=log.bleeding,
            heavy_bleeding=log.heavy_bleeding,
            fever=log.fever,
            gi_symptoms=log.gi_symptoms,
            fatigue=log.fatigue,
            sleep_hours=log.sleep_hours,
            medication_taken=log.medication_taken,
        )

    for w in patient.wearable_logs:
        entry = by_date.get(w.date)
        if entry is None:
            entry = TimelineEntry(date=w.date)
            by_date[w.date] = entry
        entry.hrv_ms = w.hrv_ms
        entry.hrv_baseline_ms = w.hrv_baseline_ms
        entry.resting_hr = w.resting_hr
        entry.skin_temp_delta_c = w.skin_temp_delta_c

    return [by_date[d] for d in sorted(by_date)]

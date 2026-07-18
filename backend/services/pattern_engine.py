"""Deterministic pattern detection.

Nothing in this file is an LLM call. Every PatternSignal it returns is
derived from explicit thresholds applied to logged data, and every
signal carries the exact evidence points that triggered it. Wording is
templated, association-only language -- "may be associated with",
never "caused by" or "this means you have...".

Rule version is bumped whenever detection thresholds change, so the
audit log can always say which rule logic produced a given signal.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from models import (
    ConfidenceLabel,
    EvidencePoint,
    JourneyStage,
    Patient,
    PatternSignal,
    PatternType,
    TimelineEntry,
)
from services.timeline_builder import build_timeline

RULE_VERSION = "pattern-engine-v1.0.0"

MIN_COMPARABLE_POINTS = 3          # below this, we don't even attempt pattern detection
MIN_CONSECUTIVE_RISE_DAYS = 3      # escalating-pain rule
TYPICAL_WINDOW_CYCLE_DAYS = set(range(1, 6))  # menstrual days 1-5 = "typical" high-pain window
HRV_DROP_RATIO = 0.97              # hrv_ms must be <= 97% of the patient's own baseline to count
MIN_HRV_COSIGNAL_POINTS = 2
MIN_POST_SURGICAL_POINTS = 6
MIN_DECLINE_DAYS = 3               # days (inclusive of trough) needed to call it a "decline"
MIN_POST_TROUGH_DAYS = 2           # consecutive days at/above trough needed to call plateau/worsening


def _is_typical_window_day(entry: TimelineEntry) -> bool:
    if entry.bleeding:
        return True
    if entry.cycle_day is not None and entry.cycle_day in TYPICAL_WINDOW_CYCLE_DAYS:
        return True
    return False


def _find_pain_escalation_run(entries: list[TimelineEntry]) -> Optional[list[TimelineEntry]]:
    """Most recent run of 3+ consecutive calendar days with strictly rising
    pain score (each day higher than the last), all outside the typical
    cycle-linked pain window. Strict increase (not just non-decreasing) is
    what keeps unrelated plateaus/noise from chaining into a false run."""

    pain_entries = [e for e in entries if e.pain_score is not None]
    pain_entries.sort(key=lambda e: e.date)

    best_run: Optional[list[TimelineEntry]] = None
    run: list[TimelineEntry] = []

    for entry in pain_entries:
        if run:
            prev = run[-1]
            consecutive_day = (entry.date - prev.date).days == 1
            strictly_rising = entry.pain_score > prev.pain_score
            if consecutive_day and strictly_rising:
                run.append(entry)
            else:
                run = [entry]
        else:
            run = [entry]

        if len(run) >= MIN_CONSECUTIVE_RISE_DAYS and all(
            not _is_typical_window_day(e) for e in run
        ):
            best_run = list(run)  # prefer the most recently found qualifying run

    return best_run


def _confidence_from_count(count: int, emerging_at: int, notable_at: int) -> ConfidenceLabel:
    if count >= notable_at:
        return ConfidenceLabel.NOTABLE
    if count > emerging_at:
        return ConfidenceLabel.MODERATE
    return ConfidenceLabel.EMERGING


def _pain_trend_message(stage: JourneyStage, run: list[TimelineEntry]) -> str:
    base = (
        f"Over the last {len(run)} days, logged pain rose from "
        f"{run[0].pain_score} to {run[-1].pain_score}, on days outside the "
        f"cycle window (day 1-5 / bleeding days) you've typically flagged as "
        f"your highest-pain window."
    )
    if stage in (JourneyStage.EXPLORING, JourneyStage.SUSPECTED_UNDIAGNOSED):
        base += (
            " A pain pattern that builds over several days outside your usual "
            "window can be useful evidence to bring to a first clinical conversation."
        )
    elif stage == JourneyStage.DIAGNOSED_MANAGING:
        base += (
            " This may be associated with a flare outside your usual pattern -- "
            "worth noting for your care team, not a sign anything specific caused it."
        )
    else:  # POST_SURGICAL
        base += (
            " Rising pain during recovery is worth mentioning to your surgical "
            "team, especially if it continues."
        )
    return base


def _detect_escalating_pain(patient: Patient, entries: list[TimelineEntry]) -> Optional[PatternSignal]:
    run = _find_pain_escalation_run(entries)
    if run is None:
        return None

    evidence = [
        EvidencePoint(date=e.date, label="pain_score", value=str(e.pain_score))
        for e in run
    ] + [
        EvidencePoint(
            date=e.date,
            label="cycle_day",
            value=str(e.cycle_day) if e.cycle_day is not None else "not tracked",
        )
        for e in run
    ]

    return PatternSignal(
        id=str(uuid.uuid4()),
        patient_id=patient.id,
        pattern_type=PatternType.ESCALATING_PAIN,
        journey_stage=patient.journey_stage,
        generated_at=datetime.now(timezone.utc),
        rule_version=RULE_VERSION,
        sample_count=len(run),
        confidence=_confidence_from_count(len(run), emerging_at=3, notable_at=6),
        evidence=evidence,
        baseline_note="Typical window = cycle day 1-5 or a logged bleeding day.",
        message=_pain_trend_message(patient.journey_stage, run),
    )


def _hrv_cosignal_message(stage: JourneyStage, points: list[TimelineEntry]) -> str:
    base = (
        f"Your recovery signal (HRV) moved below your own recent baseline on "
        f"{len(points)} of the days your pain was rising. HRV is a personal "
        f"trend signal, not a stand-alone marker of pain severity -- but your "
        f"recovery signal and pain have moved together over the last "
        f"{len(points)} days."
    )
    if stage in (JourneyStage.EXPLORING, JourneyStage.SUSPECTED_UNDIAGNOSED):
        base += " This combination may be worth describing to a clinician as part of your history."
    elif stage == JourneyStage.DIAGNOSED_MANAGING:
        base += " Worth discussing with your care team, especially if it recurs next cycle."
    else:
        base += " Worth mentioning to your surgical team alongside the pain trend above."
    return base


def _detect_hrv_cosignal(
    patient: Patient, entries: list[TimelineEntry], pain_run: Optional[list[TimelineEntry]]
) -> Optional[PatternSignal]:
    # By design this rule can never fire without a concurrent pain trend.
    if pain_run is None:
        return None

    run_dates = {e.date for e in pain_run}
    by_date = {e.date: e for e in entries}

    hrv_points = [
        by_date[d]
        for d in sorted(run_dates)
        if by_date[d].hrv_ms is not None and by_date[d].hrv_baseline_ms is not None
    ]
    if len(hrv_points) < MIN_HRV_COSIGNAL_POINTS:
        return None

    dropped = [e for e in hrv_points if e.hrv_ms <= e.hrv_baseline_ms * HRV_DROP_RATIO]
    if len(dropped) != len(hrv_points):
        return None  # require the drop on every day we have HRV data for, to stay conservative

    evidence = [
        EvidencePoint(
            date=e.date,
            label="hrv_ms_vs_baseline",
            value=f"{e.hrv_ms:.0f}ms (baseline {e.hrv_baseline_ms:.0f}ms)",
        )
        for e in hrv_points
    ]
    sleep_points = [e for e in hrv_points if e.sleep_hours is not None and e.sleep_hours < 6]
    if sleep_points:
        evidence += [
            EvidencePoint(date=e.date, label="sleep_hours", value=str(e.sleep_hours))
            for e in sleep_points
        ]

    return PatternSignal(
        id=str(uuid.uuid4()),
        patient_id=patient.id,
        pattern_type=PatternType.HRV_AUTONOMIC_COSIGNAL,
        journey_stage=patient.journey_stage,
        generated_at=datetime.now(timezone.utc),
        rule_version=RULE_VERSION,
        sample_count=len(hrv_points),
        confidence=_confidence_from_count(len(hrv_points), emerging_at=2, notable_at=5),
        evidence=evidence,
        baseline_note="HRV compared against each day's own rolling baseline, never an absolute threshold.",
        message=_hrv_cosignal_message(patient.journey_stage, hrv_points),
    )


def _post_surgical_message(label: str, first: int, trough: int, latest: int, post_trough_days: int) -> str:
    base = (
        f"Logged pain declined from {first} to {trough} after surgery, then "
        f"{'held steady around' if label == 'plateau' else 'rose to'} {latest} "
        f"over the last {post_trough_days} days."
    )
    if label == "worsening":
        base += (
            " Pain increasing after a quiet recovery stretch is a pattern worth "
            "a prompt check-in with your surgical team."
        )
    else:
        base += (
            " A break from the expected downward recovery trend may be worth "
            "mentioning at your next follow-up."
        )
    return base


def _detect_post_surgical_plateau(patient: Patient, entries: list[TimelineEntry]) -> Optional[PatternSignal]:
    if patient.journey_stage != JourneyStage.POST_SURGICAL:
        return None

    pain_entries = [e for e in entries if e.pain_score is not None]
    pain_entries.sort(key=lambda e: e.date)
    if len(pain_entries) < MIN_POST_SURGICAL_POINTS:
        return None

    # Trough = lowest pain score, requiring a real decline into it and at
    # least one point remaining after it to evaluate plateau/worsening.
    trough_idx = min(range(len(pain_entries)), key=lambda i: pain_entries[i].pain_score)
    if trough_idx < MIN_DECLINE_DAYS - 1 or trough_idx > len(pain_entries) - 1 - MIN_POST_TROUGH_DAYS:
        return None

    decline_phase = pain_entries[: trough_idx + 1]
    if decline_phase[0].pain_score - decline_phase[-1].pain_score < 2:
        return None  # not a meaningful initial improvement

    post_trough = pain_entries[trough_idx:]
    trough_score = pain_entries[trough_idx].pain_score
    stable_or_up = [e for e in post_trough if e.pain_score >= trough_score]
    # require every post-trough day logged so far to be at/above the trough
    # (a conservative definition -- a single day back below the trough resets it)
    if len(stable_or_up) != len(post_trough) or len(post_trough) - 1 < MIN_POST_TROUGH_DAYS:
        return None

    latest_score = post_trough[-1].pain_score
    label = "worsening" if latest_score > trough_score else "plateau"
    post_trough_days = len(post_trough) - 1  # days after the trough itself

    evidence = [
        EvidencePoint(date=e.date, label="pain_score", value=str(e.pain_score))
        for e in pain_entries
    ]

    return PatternSignal(
        id=str(uuid.uuid4()),
        patient_id=patient.id,
        pattern_type=PatternType.POST_SURGICAL_PLATEAU,
        journey_stage=patient.journey_stage,
        generated_at=datetime.now(timezone.utc),
        rule_version=RULE_VERSION,
        sample_count=len(pain_entries),
        confidence=_confidence_from_count(post_trough_days, emerging_at=2, notable_at=4),
        evidence=evidence,
        baseline_note=(
            f"Trough of {trough_score} on {pain_entries[trough_idx].date.isoformat()}; "
            f"comparing everything logged since to that trough (label: {label})."
        ),
        message=_post_surgical_message(
            label, decline_phase[0].pain_score, trough_score, latest_score, post_trough_days
        ),
    )


def _insufficient_data_signal(patient: Patient, count: int) -> PatternSignal:
    return PatternSignal(
        id=str(uuid.uuid4()),
        patient_id=patient.id,
        pattern_type=PatternType.INSUFFICIENT_DATA,
        journey_stage=patient.journey_stage,
        generated_at=datetime.now(timezone.utc),
        rule_version=RULE_VERSION,
        sample_count=count,
        confidence=ConfidenceLabel.EMERGING,
        evidence=[],
        baseline_note=f"Need at least {MIN_COMPARABLE_POINTS} comparable days of pain logs before a pattern can be evaluated.",
        message=(
            f"Only {count} day{'s' if count != 1 else ''} of logs so far -- not "
            "enough yet to identify a pattern. Keep logging pain, cycle, sleep, "
            "and any GI or bleeding changes; every log makes the picture clearer "
            "for your first appointment."
        ),
    )


def detect_patterns(patient: Patient) -> list[PatternSignal]:
    entries = build_timeline(patient)
    pain_point_count = sum(1 for e in entries if e.pain_score is not None)

    if pain_point_count < MIN_COMPARABLE_POINTS:
        return [_insufficient_data_signal(patient, pain_point_count)]

    patterns: list[PatternSignal] = []

    if patient.journey_stage == JourneyStage.POST_SURGICAL:
        plateau = _detect_post_surgical_plateau(patient, entries)
        if plateau is not None:
            patterns.append(plateau)
    else:
        pain_signal = _detect_escalating_pain(patient, entries)
        pain_run = _find_pain_escalation_run(entries)
        if pain_signal is not None:
            patterns.append(pain_signal)

        hrv_signal = _detect_hrv_cosignal(patient, entries, pain_run)
        if hrv_signal is not None:
            patterns.append(hrv_signal)

    return patterns

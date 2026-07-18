"""Clinician-only internal review score for the hackathon demo.

The score combines a recent structured pain average with a constrained,
AI-assisted reading of distress language from the patient's optional free-text
note. It is decision support only: it does not diagnose, triage emergencies,
or replace the existing deterministic safety rules.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Optional

from models import ClinicianRiskReview, MoodAssessment, Patient, RiskReviewBand

MODEL = os.environ.get("ENDO_LOOP_LLM_MODEL", "claude-opus-4-8")
PAIN_WEIGHT = 60
MOOD_WEIGHT = 40
RECENT_PAIN_LOGS = 7

_HIGH_DISTRESS = (
    "overwhelmed",
    "overwhelming",
    "can't cope",
    "cannot cope",
    "hopeless",
    "distressed",
    "exhausted",
    "breaking down",
)
_MODERATE_DISTRESS = (
    "anxious",
    "worried",
    "frustrated",
    "stressed",
    "struggling",
    "drained",
    "low",
)


def _fallback_mood(note: Optional[str]) -> MoodAssessment:
    if not note or not note.strip():
        return MoodAssessment(
            score_10=0,
            label="No wellbeing note available",
            source="not_available",
            note_summary="No optional feeling note was logged for this review.",
        )

    text = note.lower()
    high_hits = sum(phrase in text for phrase in _HIGH_DISTRESS)
    moderate_hits = sum(phrase in text for phrase in _MODERATE_DISTRESS)
    if high_hits:
        score, label = min(10, 7 + high_hits), "Elevated distress language"
    elif moderate_hits:
        score, label = min(6, 3 + moderate_hits), "Moderate distress language"
    else:
        score, label = 1, "No clear distress language"

    return MoodAssessment(
        score_10=score,
        label=label,
        source="fallback",
        note_summary="Keyword-based fallback used because the AI analysis service is unavailable.",
    )


def _assess_mood_with_llm(note: Optional[str]) -> Optional[MoodAssessment]:
    """Return a tightly constrained wellbeing-language score when enabled.

    This function intentionally does not call an external AI service unless
    an API key is configured. A real deployment also needs explicit consent,
    an approved data-processing agreement, and durable access controls.
    """

    if not note or not note.strip() or not os.environ.get("ANTHROPIC_API_KEY"):
        return None

    try:
        import anthropic

        client = anthropic.Anthropic()
        response = client.messages.create(
            model=MODEL,
            max_tokens=200,
            system=(
                "You are a constrained clinical-documentation classifier. "
                "Assess only emotional distress language in the supplied patient note. "
                "Do not diagnose any mental-health condition, infer intent, assess emergency risk, "
                "or give advice. Return only JSON with score_10 (integer 0-10), label (max 60 chars), "
                "and note_summary (max 140 chars)."
            ),
            messages=[
                {
                    "role": "user",
                    "content": (
                        "Score 0 for neutral/positive language and 10 for very strong distress language. "
                        f"Patient note: {note!r}"
                    ),
                }
            ],
        )
        text = next((block.text for block in response.content if block.type == "text"), None)
        if not text:
            return None
        parsed = json.loads(text)
        score = int(parsed["score_10"])
        if not 0 <= score <= 10:
            return None
        label = str(parsed["label"]).strip()[:60]
        summary = str(parsed["note_summary"]).strip()[:140]
        if not label or not summary:
            return None
        return MoodAssessment(score_10=score, label=label, source="llm", note_summary=summary)
    except Exception:
        return None


def assess_mood(note: Optional[str]) -> MoodAssessment:
    return _assess_mood_with_llm(note) or _fallback_mood(note)


def _band(score: int) -> RiskReviewBand:
    if score >= 65:
        return RiskReviewBand.PRIORITY_REVIEW
    if score >= 35:
        return RiskReviewBand.REVIEW
    return RiskReviewBand.MONITORING


def build_review(patient: Patient) -> ClinicianRiskReview:
    recent_logs = sorted(patient.daily_logs, key=lambda log: log.date)[-RECENT_PAIN_LOGS:]
    pain_score = (
        round(sum(log.pain_score for log in recent_logs) / len(recent_logs), 1)
        if recent_logs
        else 0.0
    )
    latest_note = next(
        (log.feeling_note for log in reversed(recent_logs) if log.feeling_note and log.feeling_note.strip()),
        None,
    )
    mood = assess_mood(latest_note)
    final_score = round((pain_score / 10) * PAIN_WEIGHT + (mood.score_10 / 10) * MOOD_WEIGHT)

    return ClinicianRiskReview(
        patient_id=patient.id,
        patient_name=patient.name,
        calculated_at=datetime.now(timezone.utc),
        final_score_100=final_score,
        band=_band(final_score),
        pain_score_10=pain_score,
        pain_observations=len(recent_logs),
        mood=mood,
        latest_feeling_note=latest_note,
        formula="60% recent pain average + 40% wellbeing-language score",
        clinician_note=(
            "Internal review aid only. Review the underlying pain logs and patient note alongside "
            "the existing safety flags; this score does not diagnose or determine treatment."
        ),
        patient_visible=False,
    )

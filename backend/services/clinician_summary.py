"""Builds the journey-stage-adapted, exportable clinician summary.

Deterministic composition of already-generated evidence -- no LLM call
here. The Phase 3 spec calls this output "templated per journey stage";
the templating is confined to the headline/framing text, never the
underlying evidence.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from models import (
    ClinicianSummary,
    ClinicianSummaryPatternEntry,
    EscalationLevel,
    FollowUpAnswer,
    FollowUpQA,
    FollowUpQuestion,
    JourneyStage,
    Patient,
    PatternSignal,
    PatternType,
)

_HEADLINES: dict[JourneyStage, str] = {
    JourneyStage.EXPLORING: "Starter symptom history to support a first conversation about pelvic pain.",
    JourneyStage.SUSPECTED_UNDIAGNOSED: "Symptom history to support an ongoing diagnostic conversation.",
    JourneyStage.DIAGNOSED_MANAGING: "Update on logged patterns since your last visit.",
    JourneyStage.POST_SURGICAL: "Post-surgical recovery check-in.",
}


def build_summary(
    patient: Patient,
    patterns: list[PatternSignal],
    questions: list[FollowUpQuestion],
    answers: dict[str, FollowUpAnswer],
    escalation: EscalationLevel,
    escalation_reason: Optional[str],
) -> ClinicianSummary:
    real_patterns = [p for p in patterns if p.pattern_type != PatternType.INSUFFICIENT_DATA]

    pattern_entries = [
        ClinicianSummaryPatternEntry(
            pattern_type=p.pattern_type,
            message=p.message,
            evidence=p.evidence,
            sample_count=p.sample_count,
            confidence=p.confidence,
        )
        for p in real_patterns
    ]

    follow_up = [
        FollowUpQA(
            question_text=q.question_text,
            answer_text=answers[q.id].answer_text if q.id in answers else None,
        )
        for q in questions
    ]

    return ClinicianSummary(
        patient_id=patient.id,
        patient_name=patient.name,
        journey_stage=patient.journey_stage,
        generated_at=datetime.now(timezone.utc),
        headline=_HEADLINES[patient.journey_stage],
        patterns=pattern_entries,
        follow_up=follow_up,
        patient_goals=patient.preferences.goals,
        escalation=escalation,
        escalation_reason=escalation_reason,
        insufficient_data=not real_patterns,
    )

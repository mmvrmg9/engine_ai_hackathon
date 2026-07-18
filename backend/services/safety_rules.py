"""Conservative, rules-based escalation.

Deliberately separate from pattern_engine.py: pattern signals describe
*trends*, escalation describes whether something warrants contacting a
care team. HRV never triggers escalation on its own -- it only ever
appears bundled inside an escalating-pain co-signal, and even then the
co-signal itself is not treated as an escalation trigger, only pain
severity, safety symptoms, and the post-surgical worsening pattern are.
"""

from __future__ import annotations

from models import EscalationLevel, JourneyStage, Patient, PatternSignal, PatternType, TimelineEntry

RECENT_WINDOW_DAYS = 3
HIGH_PAIN_THRESHOLD = 9
SUSTAINED_HIGH_PAIN_DAYS = 2


def _recent_entries(entries: list[TimelineEntry]) -> list[TimelineEntry]:
    return sorted(entries, key=lambda e: e.date)[-RECENT_WINDOW_DAYS:]


def evaluate_escalation(
    patient: Patient, entries: list[TimelineEntry], patterns: list[PatternSignal]
) -> tuple[EscalationLevel, str | None]:
    recent = _recent_entries(entries)

    if patient.journey_stage == JourneyStage.POST_SURGICAL:
        if any(e.fever for e in recent):
            return (
                EscalationLevel.CONTACT_CARE_TEAM,
                "Fever logged in the last few days -- post-surgical fever should be reviewed by your care team.",
            )
        if any(e.heavy_bleeding for e in recent):
            return (
                EscalationLevel.CONTACT_CARE_TEAM,
                "Heavy bleeding logged in the last few days -- please contact your care team.",
            )

        plateau = next(
            (p for p in patterns if p.pattern_type == PatternType.POST_SURGICAL_PLATEAU), None
        )
        if plateau is not None and plateau.baseline_note and "worsening" in plateau.baseline_note:
            return (
                EscalationLevel.CONTACT_CARE_TEAM,
                "Pain has increased after a quiet recovery stretch, which is worth a prompt check-in with your surgical team.",
            )
        if plateau is not None:
            return (
                EscalationLevel.WATCH,
                "Recovery has plateaued rather than continuing to improve -- worth mentioning at your next follow-up.",
            )
        return EscalationLevel.NONE, None

    # Non-post-surgical stages
    sustained_high_pain = sum(
        1 for e in recent if e.pain_score is not None and e.pain_score >= HIGH_PAIN_THRESHOLD
    )
    if sustained_high_pain >= SUSTAINED_HIGH_PAIN_DAYS:
        return (
            EscalationLevel.CONTACT_CARE_TEAM,
            f"Pain scored {HIGH_PAIN_THRESHOLD}+ on {sustained_high_pain} of the last {RECENT_WINDOW_DAYS} days -- please contact your care team.",
        )
    if any(e.fever for e in recent):
        return (
            EscalationLevel.CONTACT_CARE_TEAM,
            "Fever logged alongside pelvic symptoms -- please contact your care team.",
        )

    if any(p.pattern_type == PatternType.ESCALATING_PAIN for p in patterns):
        return (
            EscalationLevel.WATCH,
            "A rising pain trend outside your usual window was found -- worth raising at your next appointment, sooner if it continues to climb.",
        )

    return EscalationLevel.NONE, None

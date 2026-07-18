"""Append-only, in-memory audit trail.

Every pattern signal and every escalation decision shown to a patient
gets logged here with the exact text displayed, so any output can be
traced back to the rule version and evidence that produced it.
"""

from __future__ import annotations

from datetime import datetime, timezone

from models import AuditEntry, DataAccessLevel, EscalationLevel, FollowUpQuestion, PatternSignal

_AUDIT_LOG: list[AuditEntry] = []


def record_pattern(patient_id: str, signal: PatternSignal) -> None:
    _AUDIT_LOG.append(
        AuditEntry(
            timestamp=datetime.now(timezone.utc),
            patient_id=patient_id,
            entry_type="pattern",
            pattern_type=signal.pattern_type,
            rule_version=signal.rule_version,
            evidence_count=len(signal.evidence),
            sample_count=signal.sample_count,
            displayed_text=signal.message,
        )
    )


def record_escalation(
    patient_id: str, rule_version: str, level: EscalationLevel, reason: str | None
) -> None:
    if level == EscalationLevel.NONE or reason is None:
        return
    _AUDIT_LOG.append(
        AuditEntry(
            timestamp=datetime.now(timezone.utc),
            patient_id=patient_id,
            entry_type="escalation",
            pattern_type=None,
            rule_version=rule_version,
            evidence_count=0,
            sample_count=None,
            displayed_text=reason,
        )
    )


def record_question(question: FollowUpQuestion, rule_version: str) -> None:
    _AUDIT_LOG.append(
        AuditEntry(
            timestamp=datetime.now(timezone.utc),
            patient_id=question.patient_id,
            entry_type="follow_up_question",
            pattern_type=question.pattern_type,
            rule_version=rule_version,
            evidence_count=0,
            sample_count=None,
            displayed_text=question.question_text,
        )
    )


def record_answer(patient_id: str, rule_version: str, answer_text: str) -> None:
    _AUDIT_LOG.append(
        AuditEntry(
            timestamp=datetime.now(timezone.utc),
            patient_id=patient_id,
            entry_type="follow_up_answer",
            pattern_type=None,
            rule_version=rule_version,
            evidence_count=0,
            sample_count=None,
            displayed_text=answer_text,
        )
    )


def record_voice_checkin(patient_id: str, rule_version: str, neutral_summary: str) -> None:
    _AUDIT_LOG.append(
        AuditEntry(
            timestamp=datetime.now(timezone.utc),
            patient_id=patient_id,
            entry_type="voice_check_in",
            pattern_type=None,
            rule_version=rule_version,
            evidence_count=0,
            sample_count=None,
            displayed_text=neutral_summary,
        )
    )


def record_summary_share(
    patient_id: str,
    data_access: DataAccessLevel,
    patient_confirmed: bool,
) -> None:
    """Record every report made available to a care team.

    The demo does not send data to an external clinician system. This audit
    event is the handoff boundary and makes the selected consent mode visible.
    """

    mode_label = {
        DataAccessLevel.ASK_EACH_TIME: "Patient confirmed this report share.",
        DataAccessLevel.AUTOMATED_REPORT: "Automated report sharing is enabled.",
    }[data_access]
    _AUDIT_LOG.append(
        AuditEntry(
            timestamp=datetime.now(timezone.utc),
            patient_id=patient_id,
            entry_type="clinician_summary_shared",
            pattern_type=None,
            rule_version="privacy-preference-v1",
            evidence_count=0,
            sample_count=None,
            displayed_text=mode_label,
        )
    )


def get_audit_log() -> list[AuditEntry]:
    return list(_AUDIT_LOG)

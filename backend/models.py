"""Pydantic v2 data models for Endo Loop.

These models are the single source of truth for what a "patient", a
"day of logs", and a "pattern signal" look like. The pattern engine
(services/pattern_engine.py) only ever emits PatternSignal objects
built from real evidence found in DailyLog / WearableLog data -- no
free-text claims are allowed to originate anywhere else.
"""

from __future__ import annotations

from datetime import date as date_
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class JourneyStage(str, Enum):
    EXPLORING = "exploring"
    SUSPECTED_UNDIAGNOSED = "suspected_undiagnosed"
    DIAGNOSED_MANAGING = "diagnosed_managing"
    POST_SURGICAL = "post_surgical"


class FatigueLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ConfidenceLabel(str, Enum):
    """Deliberately not "low/high confidence" clinical-sounding labels --
    these describe how much data backs the observation, nothing more."""

    EMERGING = "emerging"
    MODERATE = "moderate"
    NOTABLE = "notable"


class PatternType(str, Enum):
    ESCALATING_PAIN = "escalating_pain"
    HRV_AUTONOMIC_COSIGNAL = "hrv_autonomic_cosignal"
    POST_SURGICAL_PLATEAU = "post_surgical_plateau"
    INSUFFICIENT_DATA = "insufficient_data"


class EscalationLevel(str, Enum):
    NONE = "none"
    WATCH = "watch"
    CONTACT_CARE_TEAM = "contact_care_team"


class Preferences(BaseModel):
    goals: list[str] = Field(default_factory=list)


class DailyLog(BaseModel):
    date: date_
    cycle_day: Optional[int] = Field(default=None, ge=1, le=45)
    pain_score: int = Field(ge=0, le=10)
    pain_location: Optional[str] = None
    pain_type: Optional[str] = None
    bleeding: bool = False
    heavy_bleeding: bool = False
    fever: bool = False
    gi_symptoms: list[str] = Field(default_factory=list)
    fatigue: Optional[FatigueLevel] = None
    stress_level: Optional[str] = None
    sleep_hours: Optional[float] = Field(default=None, ge=0, le=24)
    medication_taken: bool = False


class WearableLog(BaseModel):
    date: date_
    hrv_ms: float = Field(gt=0)
    hrv_baseline_ms: float = Field(gt=0)
    resting_hr: Optional[float] = None
    skin_temp_delta_c: Optional[float] = None


class Patient(BaseModel):
    id: str
    name: str
    journey_stage: JourneyStage
    preferences: Preferences = Field(default_factory=Preferences)
    surgery_date: Optional[date_] = None
    daily_logs: list[DailyLog] = Field(default_factory=list)
    wearable_logs: list[WearableLog] = Field(default_factory=list)


class PatientDB(BaseModel):
    patients: list[Patient]


class TimelineEntry(BaseModel):
    """One calendar day, symptom log and wearable reading merged."""

    date: date_
    cycle_day: Optional[int] = None
    pain_score: Optional[int] = None
    pain_location: Optional[str] = None
    pain_type: Optional[str] = None
    bleeding: bool = False
    heavy_bleeding: bool = False
    fever: bool = False
    gi_symptoms: list[str] = Field(default_factory=list)
    fatigue: Optional[FatigueLevel] = None
    sleep_hours: Optional[float] = None
    medication_taken: bool = False
    hrv_ms: Optional[float] = None
    hrv_baseline_ms: Optional[float] = None
    resting_hr: Optional[float] = None
    skin_temp_delta_c: Optional[float] = None


class EvidencePoint(BaseModel):
    date: date_
    label: str
    value: str


class PatternSignal(BaseModel):
    id: str
    patient_id: str
    pattern_type: PatternType
    journey_stage: JourneyStage
    generated_at: datetime
    rule_version: str
    sample_count: int
    confidence: ConfidenceLabel
    evidence: list[EvidencePoint]
    baseline_note: Optional[str] = None
    message: str


class PatternsResponse(BaseModel):
    patient_id: str
    journey_stage: JourneyStage
    generated_at: datetime
    patterns: list[PatternSignal]
    escalation: EscalationLevel = EscalationLevel.NONE
    escalation_reason: Optional[str] = None
    explanation: Optional[str] = None
    next_step: Optional[str] = None
    follow_up_questions: list["FollowUpQuestion"] = Field(default_factory=list)


class JourneyStageUpdate(BaseModel):
    journey_stage: JourneyStage


class FollowUpQuestion(BaseModel):
    id: str
    pattern_id: str
    patient_id: str
    pattern_type: PatternType
    question_text: str
    created_at: datetime


class FollowUpAnswerIn(BaseModel):
    question_id: str
    answer_text: str


class FollowUpAnswer(BaseModel):
    question_id: str
    pattern_id: str
    patient_id: str
    answer_text: str
    answered_at: datetime


class FollowUpQA(BaseModel):
    question_text: str
    answer_text: Optional[str] = None


class ClinicianSummaryPatternEntry(BaseModel):
    pattern_type: PatternType
    message: str
    evidence: list[EvidencePoint]
    sample_count: int
    confidence: ConfidenceLabel


class ClinicianSummary(BaseModel):
    patient_id: str
    patient_name: str
    journey_stage: JourneyStage
    generated_at: datetime
    headline: str
    patterns: list[ClinicianSummaryPatternEntry]
    follow_up: list[FollowUpQA]
    patient_goals: list[str]
    escalation: EscalationLevel
    escalation_reason: Optional[str] = None
    insufficient_data: bool = False


class AuditEntry(BaseModel):
    timestamp: datetime
    patient_id: str
    entry_type: str  # "pattern" | "escalation" | "follow_up_question" | "follow_up_answer" | "voice_check_in"
    pattern_type: Optional[PatternType] = None
    rule_version: str
    evidence_count: int
    sample_count: Optional[int] = None
    displayed_text: str


class VoiceCheckIn(BaseModel):
    """A raw spoken (or typed-as-fallback) check-in, not yet reviewed."""

    transcript: str = Field(min_length=1, max_length=2000)
    date: date_


class VoiceCheckInResult(BaseModel):
    """A draft DailyLog extracted from a transcript, for the patient to review
    and edit before it's saved via POST /patients/{id}/logs -- this endpoint
    never persists anything itself."""

    extracted_log: DailyLog
    missing_details: list[str] = Field(default_factory=list)
    follow_up_questions: list[str] = Field(default_factory=list)
    neutral_summary: str
    safety_note: Optional[str] = None

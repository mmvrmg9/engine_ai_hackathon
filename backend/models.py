from datetime import date
from enum import Enum
from pydantic import BaseModel, Field

class JourneyStage(str, Enum):
    exploring = "exploring"
    suspected = "suspected_undiagnosed"
    diagnosed = "diagnosed_managing"
    post_surgical = "post_surgical"

class DailyLog(BaseModel):
    date: date
    cycle_day: int | None = Field(default=None, ge=1, le=60)
    pain_score: int = Field(ge=0, le=10)
    pain_location: str = "unspecified"
    pain_type: str = "unspecified"
    bleeding: bool = False
    gi_symptoms: list[str] = []
    fatigue: str = "low"
    stress_level: str = "not_recorded"
    sleep_hours: float = Field(ge=0, le=24)
    medication_taken: bool = False
    fever: bool = False

class WearableLog(BaseModel):
    date: date
    hrv_ms: float = Field(gt=0)
    hrv_baseline_ms: float = Field(gt=0)
    resting_hr: float = Field(gt=0)
    skin_temp_delta_c: float = 0

class Patient(BaseModel):
    id: str
    name: str
    journey_stage: JourneyStage
    daily_logs: list[DailyLog] = []
    wearable_logs: list[WearableLog] = []

class PatternSignal(BaseModel):
    id: str
    kind: str
    title: str
    evidence: list[dict]
    sample_count: int
    confidence: str
    wording: str
    next_step: str
    escalation: bool = False

class VoiceCheckIn(BaseModel):
    transcript: str = Field(min_length=1, max_length=2000)
    date: date

class VoiceCheckInResult(BaseModel):
    extracted_log: DailyLog
    missing_details: list[str]
    follow_up_questions: list[str]
    neutral_summary: str
    safety_note: str | None = None

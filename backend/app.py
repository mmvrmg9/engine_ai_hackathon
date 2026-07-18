"""Endo Loop backend -- FastAPI + Pydantic v2.

Phases 1-3: mock data + logging, the deterministic pattern engine, and
the LLM-backed follow-up-question/explanation layer. No LLM call ever
decides whether a pattern exists -- that's services/pattern_engine.py
alone; the LLM (services/ai_coach.py) only phrases wording around
patterns the deterministic engine already found.
"""

from __future__ import annotations

import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import (
    AuditEntry,
    ClinicianSummary,
    DailyLog,
    FollowUpAnswer,
    FollowUpAnswerIn,
    FollowUpQuestion,
    JourneyStageUpdate,
    Patient,
    PatientDB,
    PatternsResponse,
    TimelineEntry,
    VoiceCheckIn,
    VoiceCheckInResult,
    WearableLog,
)
from services import ai_coach, audit_log, clinician_summary, pattern_engine, safety_rules, voice_checkin
from services.timeline_builder import build_timeline

DATA_PATH = Path(__file__).parent / "data" / "mock_patients.json"


@asynccontextmanager
async def lifespan(app: FastAPI):
    startup()
    yield


app = FastAPI(title="Endo Loop API", version="0.3.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_PATIENTS: dict[str, Patient] = {}

# Per-patient state from the most recent /patterns call -- lets the
# follow-up and clinician-summary endpoints resolve questions/answers
# generated during that call. Resets on server restart (demo-scoped).
_LATEST_PATTERNS: dict[str, PatternsResponse] = {}
_QUESTIONS: dict[str, FollowUpQuestion] = {}
_ANSWERS: dict[str, FollowUpAnswer] = {}


def _load_patients() -> dict[str, Patient]:
    raw = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    db = PatientDB.model_validate(raw)
    return {p.id: p for p in db.patients}


def startup() -> None:
    _PATIENTS.clear()
    _PATIENTS.update(_load_patients())
    _LATEST_PATTERNS.clear()
    _QUESTIONS.clear()
    _ANSWERS.clear()


def _get_patient(patient_id: str) -> Patient:
    patient = _PATIENTS.get(patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail=f"No patient with id '{patient_id}'")
    return patient


@app.get("/patients", response_model=list[Patient])
def list_patients() -> list[Patient]:
    return list(_PATIENTS.values())


@app.post("/patients/{patient_id}/logs", response_model=DailyLog)
def add_daily_log(patient_id: str, log: DailyLog) -> DailyLog:
    patient = _get_patient(patient_id)
    patient.daily_logs = [d for d in patient.daily_logs if d.date != log.date] + [log]
    return log


@app.post("/patients/{patient_id}/wearable", response_model=WearableLog)
def add_wearable_log(patient_id: str, log: WearableLog) -> WearableLog:
    patient = _get_patient(patient_id)
    patient.wearable_logs = [w for w in patient.wearable_logs if w.date != log.date] + [log]
    return log


@app.post("/patients/{patient_id}/voice-check-in", response_model=VoiceCheckInResult)
def voice_check_in(patient_id: str, check_in: VoiceCheckIn) -> VoiceCheckInResult:
    """Extracts a draft DailyLog from a spoken/typed transcript for the
    patient to review. Never saves anything -- the patient still confirms
    via the existing POST /patients/{id}/logs, so the normal pattern_engine
    and safety_rules pipeline is the only thing that ever acts on it."""
    _get_patient(patient_id)
    result = voice_checkin.extract(check_in.transcript, check_in.date)
    audit_log.record_voice_checkin(patient_id, pattern_engine.RULE_VERSION, result.neutral_summary)
    return result


@app.get("/patients/{patient_id}/timeline", response_model=list[TimelineEntry])
def get_timeline(patient_id: str) -> list[TimelineEntry]:
    patient = _get_patient(patient_id)
    return build_timeline(patient)


@app.get("/patients/{patient_id}/patterns", response_model=PatternsResponse)
def get_patterns(patient_id: str) -> PatternsResponse:
    patient = _get_patient(patient_id)
    entries = build_timeline(patient)

    patterns = pattern_engine.detect_patterns(patient)
    escalation, reason = safety_rules.evaluate_escalation(patient, entries, patterns)

    for signal in patterns:
        audit_log.record_pattern(patient_id, signal)
    audit_log.record_escalation(patient_id, pattern_engine.RULE_VERSION, escalation, reason)

    questions = ai_coach.generate_follow_up_questions(patient, patterns)
    explanation, next_step = ai_coach.generate_explanation_and_next_step(
        patient, patterns, escalation, reason
    )
    for question in questions:
        _QUESTIONS[question.id] = question
        audit_log.record_question(question, pattern_engine.RULE_VERSION)

    response = PatternsResponse(
        patient_id=patient_id,
        journey_stage=patient.journey_stage,
        generated_at=datetime.now(timezone.utc),
        patterns=patterns,
        escalation=escalation,
        escalation_reason=reason,
        explanation=explanation,
        next_step=next_step,
        follow_up_questions=questions,
    )
    _LATEST_PATTERNS[patient_id] = response
    return response


@app.post("/patterns/{pattern_id}/follow-up", response_model=FollowUpAnswer)
def answer_follow_up(pattern_id: str, payload: FollowUpAnswerIn) -> FollowUpAnswer:
    question = _QUESTIONS.get(payload.question_id)
    if question is None:
        raise HTTPException(status_code=404, detail=f"No follow-up question with id '{payload.question_id}'")
    if question.pattern_id != pattern_id:
        raise HTTPException(
            status_code=400,
            detail="question_id does not belong to the pattern in the URL",
        )

    answer = FollowUpAnswer(
        question_id=question.id,
        pattern_id=question.pattern_id,
        patient_id=question.patient_id,
        answer_text=payload.answer_text,
        answered_at=datetime.now(timezone.utc),
    )
    _ANSWERS[question.id] = answer
    audit_log.record_answer(question.patient_id, pattern_engine.RULE_VERSION, payload.answer_text)
    return answer


@app.get("/patients/{patient_id}/clinician-summary", response_model=ClinicianSummary)
def get_clinician_summary(patient_id: str) -> ClinicianSummary:
    patient = _get_patient(patient_id)

    cached = _LATEST_PATTERNS.get(patient_id)
    if cached is not None:
        patterns = cached.patterns
        questions = [q for q in cached.follow_up_questions]
        escalation = cached.escalation
        reason = cached.escalation_reason
    else:
        entries = build_timeline(patient)
        patterns = pattern_engine.detect_patterns(patient)
        escalation, reason = safety_rules.evaluate_escalation(patient, entries, patterns)
        questions = []

    answers = {q.id: _ANSWERS[q.id] for q in questions if q.id in _ANSWERS}
    return clinician_summary.build_summary(patient, patterns, questions, answers, escalation, reason)


@app.patch("/patients/{patient_id}/journey-stage", response_model=Patient)
def update_journey_stage(patient_id: str, update: JourneyStageUpdate) -> Patient:
    patient = _get_patient(patient_id)
    patient.journey_stage = update.journey_stage
    return patient


@app.get("/audit-log", response_model=list[AuditEntry])
def get_audit_log() -> list[AuditEntry]:
    return audit_log.get_audit_log()

"""Covers the Phase-3 AI layer's guardrails:

- The LLM never decides whether a pattern exists -- these tests only
  exercise wording (follow-up questions, explanation, next step).
- At most two follow-up questions, none for insufficient-data-only state.
- Association-only, non-diagnostic, non-medication language, always,
  regardless of whether the deterministic fallback or the LLM path
  produced the text (the fallback path is what's forced here, since
  tests unset ANTHROPIC_API_KEY for determinism -- the same is_safe
  check runs on LLM output too, see services/ai_coach.py).
- CONTACT_CARE_TEAM escalations skip the LLM and always use the
  deterministic safety copy.
"""

import json
from pathlib import Path

import pytest
from models import EscalationLevel, JourneyStage, PatientDB, PatternType
from services import ai_coach, pattern_engine
from services.language_guard import is_safe

DATA_PATH = Path(__file__).parent.parent / "data" / "mock_patients.json"


@pytest.fixture(autouse=True)
def no_llm_credentials(monkeypatch):
    # Force the deterministic fallback path so these tests are fast,
    # free, and reproducible -- the safety checks they exercise apply
    # identically to LLM output (see ai_coach._call_llm callers).
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)


@pytest.fixture(scope="module")
def db() -> PatientDB:
    raw = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    return PatientDB.model_validate(raw)


@pytest.fixture
def priya(db):
    return next(p for p in db.patients if p.id == "P001")


@pytest.fixture
def mei(db):
    return next(p for p in db.patients if p.id == "P002")


@pytest.fixture
def sam(db):
    return next(p for p in db.patients if p.id == "P003")


def test_language_guard_flags_banned_phrases():
    assert is_safe("Worth discussing with your care team.") is True
    for phrase in ("caused by", "this means you have", "increase your dose"):
        assert is_safe(f"Some text that is {phrase} something.") is False


def test_priya_gets_at_most_two_questions_grounded_in_her_patterns(priya):
    patterns = pattern_engine.detect_patterns(priya)
    questions = ai_coach.generate_follow_up_questions(priya, patterns)
    assert 1 <= len(questions) <= ai_coach.MAX_FOLLOW_UP_QUESTIONS
    pattern_ids = {p.id for p in patterns}
    for q in questions:
        assert q.pattern_id in pattern_ids
        assert q.patient_id == priya.id
        assert is_safe(q.question_text)


def test_mei_insufficient_data_gets_no_follow_up_questions(mei):
    patterns = pattern_engine.detect_patterns(mei)
    assert patterns[0].pattern_type == PatternType.INSUFFICIENT_DATA
    questions = ai_coach.generate_follow_up_questions(mei, patterns)
    assert questions == []


def test_sam_post_surgical_questions_reference_surgical_site(sam):
    patterns = pattern_engine.detect_patterns(sam)
    questions = ai_coach.generate_follow_up_questions(sam, patterns)
    assert len(questions) <= ai_coach.MAX_FOLLOW_UP_QUESTIONS
    assert all(q.pattern_type == PatternType.POST_SURGICAL_PLATEAU for q in questions)


def test_explanation_and_next_step_are_safe_and_nonempty(priya):
    patterns = pattern_engine.detect_patterns(priya)
    explanation, next_step = ai_coach.generate_explanation_and_next_step(
        priya, patterns, EscalationLevel.WATCH, "some reason"
    )
    assert explanation and next_step
    assert is_safe(explanation)
    assert is_safe(next_step)
    assert "diagnos" not in explanation.lower()


def test_next_step_never_gives_medication_dosing_advice(priya):
    patterns = pattern_engine.detect_patterns(priya)
    _, next_step = ai_coach.generate_explanation_and_next_step(
        priya, patterns, EscalationLevel.NONE, None
    )
    assert is_safe(next_step)
    for banned_dosing_phrase in ("increase your dose", "decrease your dose", "milligram"):
        assert banned_dosing_phrase not in next_step.lower()


def test_contact_care_team_escalation_uses_deterministic_safety_copy(sam):
    patterns = pattern_engine.detect_patterns(sam)
    explanation, next_step = ai_coach.generate_explanation_and_next_step(
        sam, patterns, EscalationLevel.CONTACT_CARE_TEAM, "Fever logged."
    )
    assert next_step.startswith("Contact your care team promptly.")
    assert "Fever logged." in next_step


def test_journey_stage_changes_next_step_wording_for_identical_pattern(priya):
    patterns = pattern_engine.detect_patterns(priya)

    priya.journey_stage = JourneyStage.EXPLORING
    _, exploring_step = ai_coach.generate_explanation_and_next_step(
        priya, patterns, EscalationLevel.NONE, None
    )

    priya.journey_stage = JourneyStage.DIAGNOSED_MANAGING
    _, managing_step = ai_coach.generate_explanation_and_next_step(
        priya, patterns, EscalationLevel.NONE, None
    )

    assert exploring_step != managing_step

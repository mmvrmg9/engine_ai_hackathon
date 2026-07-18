"""Covers the Phase-2 checkpoint list from ENDO_LOOP_CODEX_PROMPT.md:

- Mock data loads and validates with Pydantic.
- Pain-trend pattern requires 3+ consecutive comparable data points.
- HRV co-signal only fires alongside a concurrent pain trend, never on HRV alone.
- Post-surgical plateau logic is distinct from the general escalating-pain rule.
- Every pattern displays its exact evidence and sample count.
- Language is association-only -- no causal or diagnostic phrasing anywhere.
- Mei (sparse data) receives an "insufficient data, keep logging" state, not an invented pattern.
"""

import json
from pathlib import Path

import pytest
from models import JourneyStage, PatientDB, PatternType
from services import pattern_engine, safety_rules
from services.timeline_builder import build_timeline

DATA_PATH = Path(__file__).parent.parent / "data" / "mock_patients.json"

BANNED_PHRASES = [
    "caused by",
    "this means you have",
    "you have endometriosis",
    "this is endometriosis",
    "central sensitization",
    "diagnos",  # catches "diagnosis" / "diagnose" / "diagnostic" claims in patient-facing text
]


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


def test_mock_data_loads_and_validates(db):
    assert len(db.patients) == 3
    assert {p.id for p in db.patients} == {"P001", "P002", "P003"}


def test_priya_escalating_pain_pattern(priya):
    patterns = pattern_engine.detect_patterns(priya)
    pain_patterns = [p for p in patterns if p.pattern_type == PatternType.ESCALATING_PAIN]
    assert len(pain_patterns) == 1
    signal = pain_patterns[0]
    assert signal.sample_count >= 3
    assert len(signal.evidence) > 0
    # exact evidence dates match the rising-pain days in mock data
    evidence_dates = {e.date.isoformat() for e in signal.evidence if e.label == "pain_score"}
    assert evidence_dates == {"2026-07-10", "2026-07-11", "2026-07-12", "2026-07-13", "2026-07-14"}


def test_priya_hrv_cosignal_requires_pain_trend(priya):
    patterns = pattern_engine.detect_patterns(priya)
    hrv_patterns = [p for p in patterns if p.pattern_type == PatternType.HRV_AUTONOMIC_COSIGNAL]
    assert len(hrv_patterns) == 1
    assert any(p.pattern_type == PatternType.ESCALATING_PAIN for p in patterns)


def test_hrv_cosignal_never_fires_alone():
    # Directly exercise the private detector: no pain run -> no HRV signal,
    # regardless of how dramatic the HRV drop looks.
    import types

    fake_patient = types.SimpleNamespace(id="X", journey_stage=JourneyStage.DIAGNOSED_MANAGING)
    result = pattern_engine._detect_hrv_cosignal(fake_patient, entries=[], pain_run=None)
    assert result is None


def test_sam_post_surgical_plateau_distinct_from_escalating_pain(sam):
    patterns = pattern_engine.detect_patterns(sam)
    types_found = {p.pattern_type for p in patterns}
    assert PatternType.POST_SURGICAL_PLATEAU in types_found
    assert PatternType.ESCALATING_PAIN not in types_found  # post-surgical never runs the general rule
    plateau = next(p for p in patterns if p.pattern_type == PatternType.POST_SURGICAL_PLATEAU)
    assert plateau.sample_count >= 6
    assert len(plateau.evidence) > 0


def test_sam_triggers_contact_care_team_escalation(sam):
    entries = build_timeline(sam)
    patterns = pattern_engine.detect_patterns(sam)
    level, reason = safety_rules.evaluate_escalation(sam, entries, patterns)
    assert level.value == "contact_care_team"
    assert reason is not None


def test_mei_gets_insufficient_data_not_an_invented_pattern(mei):
    patterns = pattern_engine.detect_patterns(mei)
    assert len(patterns) == 1
    assert patterns[0].pattern_type == PatternType.INSUFFICIENT_DATA
    assert patterns[0].sample_count == 1
    assert "keep logging" in patterns[0].message.lower()


@pytest.mark.parametrize("patient_fixture", ["priya", "mei", "sam"])
def test_no_causal_or_diagnostic_language(request, patient_fixture):
    patient = request.getfixturevalue(patient_fixture)
    patterns = pattern_engine.detect_patterns(patient)
    for signal in patterns:
        text = signal.message.lower()
        for phrase in BANNED_PHRASES:
            assert phrase not in text, f"banned phrase '{phrase}' found in: {signal.message}"


def test_every_pattern_has_evidence_and_sample_count(priya, sam):
    for patient in (priya, sam):
        for signal in pattern_engine.detect_patterns(patient):
            assert signal.sample_count > 0
            if signal.pattern_type != PatternType.INSUFFICIENT_DATA:
                assert len(signal.evidence) > 0
            assert signal.rule_version == pattern_engine.RULE_VERSION

import json
from pathlib import Path

import pytest

from models import PatientDB
from services.risk_evaluator import build_review


@pytest.fixture
def sample_patients():
    path = Path(__file__).parent.parent / "data" / "mock_patients.json"
    db = PatientDB.model_validate(json.loads(path.read_text(encoding="utf-8")))
    return {patient.id: patient for patient in db.patients}


def test_review_combines_recent_pain_and_wellbeing_language(sample_patients):
    review = build_review(sample_patients["P001"])

    assert review.patient_visible is False
    assert review.pain_observations == 7
    assert review.pain_score_10 == 4.4
    assert review.mood.score_10 == 8
    assert review.final_score_100 == 58
    assert review.band.value == "review"
    assert review.mood.source == "fallback"


def test_no_note_is_explicitly_not_available(sample_patients):
    review = build_review(sample_patients["P002"])

    assert review.mood.source == "not_available"
    assert review.mood.score_10 == 0

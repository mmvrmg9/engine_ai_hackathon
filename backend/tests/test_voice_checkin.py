"""Voice check-in: a demo-safe parser that turns a transcript into a draft
DailyLog for review, plus the /voice-check-in endpoint that exposes it.

Ported from the vossco-features branch and adapted to this repo's DailyLog
schema (services/voice_checkin.py). The endpoint must never save a log or
decide a pattern -- both stay the sole responsibility of the existing
POST /patients/{id}/logs and services/pattern_engine.py.
"""

from datetime import date

import pytest
from fastapi.testclient import TestClient

from services.voice_checkin import extract


def test_extracts_pain_score_location_type_and_sleep():
    result = extract(
        "Today has been difficult. The pain is 7 out of 10, low on my left side, "
        "cramping, and I slept about 4 hours.",
        date(2026, 7, 18),
    )
    log = result.extracted_log
    assert log.pain_score == 7
    assert log.pain_location == "lower_left_pelvic"
    assert log.pain_type == "cramping"
    assert log.sleep_hours == 4
    assert result.missing_details == ["whether you have noticed any tummy or bowel symptoms"]


def test_missing_details_produce_at_most_two_follow_up_questions():
    result = extract("It's been an okay day I guess.", date(2026, 7, 18))
    assert len(result.follow_up_questions) <= 2
    assert result.extracted_log.pain_score == 0
    assert "a pain score from 0 to 10" in result.missing_details


def test_fever_mention_sets_safety_note_but_no_escalation_field():
    result = extract("Pain is 3 out of 10 but I've had a fever since this morning.", date(2026, 7, 18))
    assert result.safety_note is not None
    assert "care team" in result.safety_note.lower()
    assert result.extracted_log.fever is True


def test_no_fever_mention_leaves_safety_note_none():
    result = extract("Pain is 2 out of 10, slept 8 hours, no tummy symptoms.", date(2026, 7, 18))
    assert result.safety_note is None


def test_explicit_no_gi_symptoms_phrase_is_recognized_as_known():
    result = extract("Pain 2 out of 10, no tummy symptoms today, slept 7 hours.", date(2026, 7, 18))
    assert "whether you have noticed any tummy or bowel symptoms" not in result.missing_details
    assert result.extracted_log.gi_symptoms == []


@pytest.fixture(autouse=True)
def no_llm_credentials(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)


@pytest.fixture
def client():
    from app import app

    with TestClient(app) as c:
        yield c


def test_voice_check_in_endpoint_returns_draft_without_saving(client):
    resp = client.post(
        "/patients/P002/voice-check-in",
        json={"transcript": "Pain is 5 out of 10, right side, aching, slept 6 hours.", "date": "2026-07-18"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["extracted_log"]["pain_score"] == 5
    assert body["extracted_log"]["pain_location"] == "lower_right_pelvic"

    # Endpoint is read-only -- P002's stored logs must be untouched.
    patient = client.get("/patients").json()
    mei = next(p for p in patient if p["id"] == "P002")
    assert "2026-07-18" not in [log["date"] for log in mei["daily_logs"]]


def test_voice_check_in_unknown_patient_404s(client):
    resp = client.post(
        "/patients/does-not-exist/voice-check-in",
        json={"transcript": "Pain is 5 out of 10.", "date": "2026-07-18"},
    )
    assert resp.status_code == 404


def test_voice_check_in_draft_can_then_be_saved_via_existing_logs_endpoint(client):
    draft = client.post(
        "/patients/P002/voice-check-in",
        json={"transcript": "Pain is 4 out of 10, low on my left side, sharp, slept 6.5 hours, no tummy symptoms.", "date": "2026-07-19"},
    ).json()

    save_resp = client.post("/patients/P002/logs", json=draft["extracted_log"])
    assert save_resp.status_code == 200

    timeline = client.get("/patients/P002/timeline").json()
    assert any(entry["date"] == "2026-07-19" and entry["pain_score"] == 4 for entry in timeline)


def test_voice_check_in_is_recorded_in_audit_log(client):
    client.post(
        "/patients/P001/voice-check-in",
        json={"transcript": "Pain is 3 out of 10, slept 7 hours.", "date": "2026-07-18"},
    )
    audit = client.get("/audit-log").json()
    assert any(entry["entry_type"] == "voice_check_in" and entry["patient_id"] == "P001" for entry in audit)

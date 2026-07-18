"""End-to-end API tests for the Phase 3 endpoints: /patterns (extended
with explanation/next_step/follow_up_questions), /patterns/{id}/follow-up,
and /patients/{id}/clinician-summary.
"""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def no_llm_credentials(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)


@pytest.fixture
def client():
    from app import app

    with TestClient(app) as c:
        yield c


def test_priya_patterns_endpoint_includes_ai_layer(client):
    resp = client.get("/patients/P001/patterns")
    assert resp.status_code == 200
    body = resp.json()
    assert body["explanation"]
    assert body["next_step"]
    assert 1 <= len(body["follow_up_questions"]) <= 2
    assert body["escalation"] in ("none", "watch", "contact_care_team")


def test_mei_patterns_endpoint_has_no_follow_up_questions(client):
    resp = client.get("/patients/P002/patterns")
    assert resp.status_code == 200
    body = resp.json()
    assert body["patterns"][0]["pattern_type"] == "insufficient_data"
    assert body["follow_up_questions"] == []


def test_follow_up_round_trip(client):
    patterns_resp = client.get("/patients/P001/patterns").json()
    question = patterns_resp["follow_up_questions"][0]

    answer_resp = client.post(
        f"/patterns/{question['pattern_id']}/follow-up",
        json={"question_id": question["id"], "answer_text": "Different from my usual period pain."},
    )
    assert answer_resp.status_code == 200
    answer = answer_resp.json()
    assert answer["question_id"] == question["id"]
    assert answer["answer_text"] == "Different from my usual period pain."

    summary = client.get("/patients/P001/clinician-summary").json()
    matching = [qa for qa in summary["follow_up"] if qa["question_text"] == question["question_text"]]
    assert matching and matching[0]["answer_text"] == "Different from my usual period pain."


def test_follow_up_rejects_mismatched_pattern_id(client):
    patterns_resp = client.get("/patients/P001/patterns").json()
    question = patterns_resp["follow_up_questions"][0]

    resp = client.post(
        "/patterns/not-the-right-pattern-id/follow-up",
        json={"question_id": question["id"], "answer_text": "whatever"},
    )
    assert resp.status_code == 400


def test_follow_up_unknown_question_404s(client):
    resp = client.post(
        "/patterns/some-pattern/follow-up",
        json={"question_id": "does-not-exist", "answer_text": "whatever"},
    )
    assert resp.status_code == 404


def test_sam_clinician_summary_is_post_surgical_headline(client):
    client.get("/patients/P003/patterns")  # populate _LATEST_PATTERNS
    summary = client.get("/patients/P003/clinician-summary").json()
    assert summary["journey_stage"] == "post_surgical"
    assert "recovery" in summary["headline"].lower()
    assert summary["escalation"] == "contact_care_team"


def test_clinician_summary_without_prior_patterns_call_still_works(client):
    # No /patterns call for P002 in this test -- summary must compute fresh.
    summary = client.get("/patients/P002/clinician-summary").json()
    assert summary["insufficient_data"] is True
    assert summary["patterns"] == []


def test_journey_stage_toggle_changes_patterns_output_for_identical_data(client):
    client.patch("/patients/P001/journey-stage", json={"journey_stage": "exploring"})
    exploring_resp = client.get("/patients/P001/patterns").json()

    client.patch("/patients/P001/journey-stage", json={"journey_stage": "diagnosed_managing"})
    managing_resp = client.get("/patients/P001/patterns").json()

    assert exploring_resp["next_step"] != managing_resp["next_step"]

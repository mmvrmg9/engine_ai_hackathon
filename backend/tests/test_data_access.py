"""Tests for patient-controlled clinician-report sharing."""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from app import app

    with TestClient(app) as test_client:
        yield test_client


def test_private_mode_blocks_clinician_report_sharing(client: TestClient):
    updated = client.patch("/patients/P001/data-access", json={"data_access": "private"})
    assert updated.status_code == 200
    assert updated.json()["preferences"]["data_access"] == "private"

    share = client.post("/patients/P001/clinician-summary/share", json={"patient_confirmed": True})
    assert share.status_code == 403
    assert "private" in share.json()["detail"].lower()


def test_ask_each_time_requires_explicit_confirmation(client: TestClient):
    client.patch("/patients/P001/data-access", json={"data_access": "ask_each_time"})

    unconfirmed = client.post("/patients/P001/clinician-summary/share", json={})
    assert unconfirmed.status_code == 409
    assert "confirmation" in unconfirmed.json()["detail"].lower()

    confirmed = client.post("/patients/P001/clinician-summary/share", json={"patient_confirmed": True})
    assert confirmed.status_code == 200
    body = confirmed.json()
    assert body["data_access"] == "ask_each_time"
    assert body["patient_confirmed"] is True


def test_automated_report_mode_does_not_require_prompt(client: TestClient):
    client.patch("/patients/P003/data-access", json={"data_access": "automated_report"})

    # Automated mode marks a report ready as part of the regular pattern check.
    patterns = client.get("/patients/P003/patterns")
    assert patterns.status_code == 200

    share = client.post("/patients/P003/clinician-summary/share", json={})
    assert share.status_code == 200
    body = share.json()
    assert body["data_access"] == "automated_report"
    assert body["patient_confirmed"] is False

    audit_entries = client.get("/audit-log").json()
    assert any(
        entry["patient_id"] == "P003" and entry["entry_type"] == "clinician_summary_shared"
        for entry in audit_entries
    )

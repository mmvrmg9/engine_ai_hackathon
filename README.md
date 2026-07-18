# engine_ai_hackathon

## Endo Loop MVP

Phase 1–2 implementation of the Endo Loop hackathon prompt: synthetic patient data, Pydantic validation, deterministic pain/HRV/post-surgical pattern rules, audit entries, and a minimal mobile-friendly demo UI.

### Run

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app:app --reload
```

Open `frontend/index.html` in a browser. The API exposes `/patients/P001/patterns`, `/patients/P002/patterns`, `/patients/P003/patterns`, and `/audit-log`.

This is a non-diagnostic prototype. Pattern output is based on synthetic data and deterministic rules; HRV is never used alone to make a clinical claim.

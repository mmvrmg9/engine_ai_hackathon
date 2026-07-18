# engine_ai_hackathon

## Endo Loop MVP

Phase 1–2 implementation of the Endo Loop hackathon prompt: synthetic patient data, Pydantic validation, deterministic pain/HRV/post-surgical pattern rules, audit entries, a minimal mobile-friendly demo UI, and a reviewable voice check-in flow.

### Run

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app:app --reload
```

Open `frontend/index.html` in a browser. The API exposes `/patients/P001/patterns`, `/patients/P002/patterns`, `/patients/P003/patterns`, `/patients/{id}/voice-check-in`, and `/audit-log`.

The voice check-in uses browser speech recognition when available, with typed input as a fallback. It extracts a draft log, identifies missing details, and asks no more than two follow-up questions. The draft is always shown for patient review before it is saved. The included parser is a demo-safe local boundary; a production LLM voice agent should be constrained to the same schema and must never decide patterns or provide diagnosis/treatment advice.

This is a non-diagnostic prototype. Pattern output is based on synthetic data and deterministic rules; HRV is never used alone to make a clinical claim.

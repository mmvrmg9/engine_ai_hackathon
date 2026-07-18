# Endo Loop

Endo Loop is a non-diagnostic, at-home pattern journal for endometriosis and chronic pelvic pain. It helps a person capture symptoms, sleep and wearable context, notice possible multi-day patterns, and prepare a clearer conversation with their care team.

The app does not diagnose, measure inflammation, replace clinical care, or recommend medication changes. It uses synthetic data for the hackathon demo.

## What is in the app

The React app has four screens:

- **Today**: the quick daily log, the latest pattern status, safety messaging, and one inline follow-up question.
- **My Patterns**: evidence-backed pattern cards and the exact dates/data points behind them.
- **Share with my care team**: a printable/copyable clinician summary containing patterns, follow-up answers, safety flags, and wearable observations.
- **Journey Stage**: patient-selected context that changes wording and next-step framing without assigning a diagnosis.

The Today screen offers two ways to log the same `DailyLog` structure:

- Manual entry uses tap-friendly pain circles, location/type chips, bleeding/fever/medication toggles, GI symptoms, fatigue, stress, sleep, and optional cycle day.
- Voice check-in accepts speech or typed text, drafts the same fields, asks up to two missing-context questions, and requires review before saving. The parser understands natural phrases such as “seven out of ten” and “I slept for three hours.”

## Data flow

```text
Manual or voice check-in
        ↓
Pydantic validation
        ↓
DailyLog + WearableLog timeline
        ↓
Deterministic pattern engine
        ↓
Safety rules + guarded wording
        ↓
Today / My Patterns / Care-team summary
```

Patterns are decided locally in `backend/services/pattern_engine.py`. The AI coach, when configured, may phrase questions and explanations only after a pattern exists; it never decides whether a pattern exists. If no AI key or SDK is available, deterministic fallback wording is used.

## Wearable data

`WearableLog` supports the device fields that are useful for this MVP:

- HRV/RMSSD and the patient’s own HRV baseline
- Resting heart rate
- Skin temperature deviation from baseline
- Deep sleep percentage, REM percentage, and sleep awakenings
- Respiratory rate
- Steps/activity
- EDA/skin conductance when the device provides it

The care-team report shows the latest seven wearable entries. Missing device fields appear as **Not recorded**; the app never infers them. HRV is only presented as a personal trend signal and is not used alone to make a clinical claim.

## Repository structure

```text
backend/
  app.py                         FastAPI routes and in-memory demo state
  models.py                      Pydantic source-of-truth data models
  data/mock_patients.json        Priya, Mei and Sam synthetic demo data
  services/pattern_engine.py     Deterministic pain/HRV/post-surgical rules
  services/safety_rules.py       Conservative escalation rules
  services/ai_coach.py           Optional LLM wording with safe fallback
  services/voice_checkin.py      Speech/text to reviewable DailyLog draft
  services/clinician_summary.py  Exportable summary composition
  services/timeline_builder.py   Daily + wearable timeline shaping
  services/language_guard.py     Non-diagnostic and medication-safety checks
  services/audit_log.py          Append-only demo audit trail
  tests/                         Backend and voice-check-in coverage
frontend/
  src/App.tsx                    React application shell and routes
  src/pages/                     Today, Patterns, Share, Journey Stage
  src/components/                Logging, voice, evidence and navigation UI
  src/lib/labels.ts              Shared patient-facing labels and date helpers
  package.json                   Frontend scripts and dependencies
requirements.txt                 Backend dependencies used by Render/local setup
render.yaml                      Backend deployment configuration
```

## Run locally

From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate       # macOS/Linux
# .venv\\Scripts\\activate     # Windows
pip install -r requirements.txt
```

Start the API:

```bash
cd backend
uvicorn app:app --reload
```

In a second terminal, install and start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite proxy sends `/api` requests to `http://127.0.0.1:8000`. For a deployed frontend, set `VITE_API_BASE` to the backend URL.

Useful API routes include:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/patients` | List synthetic patients |
| `POST` | `/patients/{id}/logs` | Save a reviewed symptom log |
| `POST` | `/patients/{id}/voice-check-in` | Draft a log from speech/text without saving |
| `POST` | `/patients/{id}/wearable` | Add a wearable entry |
| `GET` | `/patients/{id}/timeline` | Merge symptoms and wearable data by date |
| `GET` | `/patients/{id}/patterns` | Run deterministic patterns and safety rules |
| `GET` | `/patients/{id}/clinician-summary` | Build the exportable GP summary |
| `GET` | `/audit-log` | Inspect demo audit events |

## Tests and builds

```bash
cd backend
pytest

cd ../frontend
npx tsc -b
npm run build
```

## Optional AI wording

The optional Anthropic integration is configured with `ANTHROPIC_API_KEY` and `ENDO_LOOP_LLM_MODEL`. It is not required to run the app. The deterministic fallback remains the source of truth for safe behavior, and `language_guard.py` rejects diagnostic, causal, or medication-change wording.

## Safety boundaries

- Possible associations are not diagnoses or causes.
- A minimum of three comparable data points is required for a pattern.
- HRV never creates a pattern on its own.
- Post-surgical escalation is handled separately from general pain trends.
- Concerning symptoms route the user to their care team rather than an in-app risk score.
- The GP summary reports recorded evidence; it does not convert wearable readings into an inflammation diagnosis.

## Contributors

Authors: Chaeyoon, Marco
Co-authored: Vossco Nguyen

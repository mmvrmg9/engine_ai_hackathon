# Tech Stack — Endo Loop

## Frontend (`frontend/`)
- React 19 + React Router 7 (SPA)
- TypeScript 6, Vite 8 (build/dev server)
- Tailwind CSS 4 (via `@tailwindcss/vite`), rose colour theme throughout
- Recharts 3 (data visualisation for patterns/trends)
- Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) — browser-native speech-to-text for the voice check-in mic; no external speech SDK or model
- oxlint (linting)
- Deployed on **Vercel**, with `vercel.json` rewriting all routes to `index.html` so client-side (React Router) paths work on direct navigation and refresh

## Backend (`backend/`)
- Python, **FastAPI** (+ CORS middleware) as the web framework
- **Uvicorn** (ASGI server)
- **Pydantic** (data models/validation, `models.py`)
- **Anthropic SDK (optional)** — calls Claude for AI coach follow-up questions and wording when `ANTHROPIC_API_KEY` is configured; deterministic fallback template text is used otherwise
- `services/voice_checkin.py` — a deterministic regex/keyword parser, **not an LLM**, that turns a voice-check-in transcript into a draft `DailyLog` (understands digits and spoken number words, e.g. "seven out of ten", plus stress/nausea keywords)
- Custom services: pattern engine, safety rules, timeline builder, clinician summary, audit log, language guard, voice check-in
- **pytest** + **httpx** for testing
- Deployed on **Render** (`render.yaml`), free web service plan

## Data
- Mock patient data as JSON (`backend/data/mock_patients.json`) — no external database in this phase; all state is in-memory and resets on backend restart
- Wearable data is validated by `WearableLog`: HRV/baseline, resting heart rate, skin temperature deviation, sleep architecture, awakenings, respiratory rate, steps, and optional EDA. The latest seven entries are included in the clinician summary; missing fields remain unrecorded rather than inferred
- `Preferences.data_access` (`private` / `ask_each_time` / `automated_report`) controls whether a patient's clinician summary can be shared with their care team; every share attempt and decision is written to the append-only audit log

## Architecture
Split deployment — React frontend on Vercel talking to a FastAPI backend on Render. Claude is optional and only phrases already-detected patterns and questions; it never decides whether a pattern exists.

## Deployment (this repo)
- **Frontend:** https://engine-ai-hackathon-frontend.vercel.app (Vercel project `engine-ai-hackathon-frontend`, deployed from `frontend/`)
- **Backend:** https://engine-ai-hackathon-backend.onrender.com (Render Blueprint synced from `render.yaml`, connected via public repo URL since the GitHub App on the Render account isn't authorised for `mmvrmg9/engine_ai_hackathon`)
- Neither deployment currently auto-deploys on push (Vercel's Git integration and Render's Auto-Deploy both require GitHub App access to this repo, which the connected accounts don't have) — redeploy manually with `vercel --prod` in `frontend/`, or "Manual sync"/"Deploy latest commit" on the Render Blueprint.
- `ANTHROPIC_API_KEY` is unset on the Render service; the AI-coach layer runs on its deterministic fallback template until someone adds the key in Render's dashboard.

## Release
- Tagged `v0.1.0` on GitHub, covering the merged pattern engine, voice check-in, patient-controlled report sharing, and wearable-observations work.

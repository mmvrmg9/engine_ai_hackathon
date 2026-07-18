# Tech Stack — Endo Loop

## Frontend (`frontend/`)
- React 19 + React Router 7 (SPA)
- TypeScript 6, Vite 8 (build/dev server)
- Tailwind CSS 4 (via `@tailwindcss/vite`)
- Recharts 3 (data visualization for patterns/trends)
- oxlint (linting)
- Deployed on **Vercel**

## Backend (`backend/`)
- Python, **FastAPI** (+ CORS middleware) as the web framework
- **Uvicorn** (ASGI server)
- **Pydantic** (data models/validation, `models.py`)
- **Anthropic SDK** — calls Claude (`claude-opus-4-8` by default, overridable via `ENDO_LOOP_LLM_MODEL`) for the AI coach follow-up questions
- Custom services: pattern engine, safety rules, timeline builder, clinician summary, audit log, language guard
- **pytest** + **httpx** for testing
- Deployed on **Render** (`render.yaml`), free web service plan

## Data
- Mock patient data as JSON (`backend/data/mock_patients.json`) — no external database in this phase

## Architecture
Split deployment — React frontend on Vercel talking to a FastAPI backend on Render, with Claude (Anthropic API) powering the LLM-driven follow-up question logic.

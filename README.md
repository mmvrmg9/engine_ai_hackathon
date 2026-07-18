# Endo Loop

An AI-supported at-home pattern layer for endometriosis and chronic pelvic pain.
Endo Loop combines pain, cycle, sleep, and autonomic (HRV) data into transparent,
plain-language observations, a safe next step, and a clinician-ready summary --
adapted to where the patient actually is in their care journey.

**Endo Loop does not diagnose.** It never says "this is endometriosis" or "this
is central sensitization." It surfaces *possible patterns*, shows the exact
evidence behind them, and helps a patient prepare a better conversation with
their clinical team.

Built for the eMed hackathon challenge: *"At-home chronic condition management
powered by AI."*

Authors: Chaeyoon, Marco
Co-authored: Vossco Nguyen

## Status

**All four build phases are complete: mock data + logging, the deterministic
pattern engine, the LLM follow-up/wording layer, and the React patient
experience.** See [ENDO_LOOP_CODEX_PROMPT.md](ENDO_LOOP_CODEX_PROMPT.md) for
the refined build spec, or [ENDO_LOOP_CODEX_BUILD_PROMPT.txt](ENDO_LOOP_CODEX_BUILD_PROMPT.txt)
for the original hackathon build prompt.

## Why deterministic rules, not an LLM, decide patterns

**Whether a pattern exists at all is decided entirely by
`backend/services/pattern_engine.py`** -- explicit thresholds applied to
logged data, nothing probabilistic. Every signal returned carries its exact
evidence points, sample count, and a confidence label describing *how much
data* backs it (not clinical certainty).

The LLM (`backend/services/ai_coach.py`) runs strictly *after* the pattern
engine, and only to:
1. phrase up to two follow-up questions grounded in the evidence already found, and
2. polish the plain-language explanation and safe next-step wording.

It is never asked whether a pattern exists, and every piece of text it
produces -- including the fixed set of fallback questions it's allowed to
reword -- is checked against `backend/services/language_guard.py` before it's
shown to a patient; anything that fails is discarded in favor of a
deterministic template. **The app runs correctly with no LLM configured at
all** -- `ANTHROPIC_API_KEY` unset (or the `anthropic` package missing)
degrades every AI-layer call to its deterministic template, invisibly to the
caller.

## Safety / non-diagnostic limitations

- Language is association-only: "may be associated with," "worth discussing" --
  never "caused by" or "this means you have..." Enforced twice: once by how
  the deterministic templates are written, and again by
  `language_guard.is_safe()` on any LLM output before it's returned.
- HRV is described only as a personal trend signal compared to the patient's
  own rolling baseline. **It never triggers a pattern or an escalation flag on
  its own** -- it only ever appears alongside a concurrent rising-pain trend.
- The safe next-step recommendation stays behavioral/self-care (sleep,
  pacing, logging, contacting a care team) and never suggests a medication,
  dose, or medication change -- checked by the same language guard.
- Escalation ("contact your care team") is a separate, conservative rules
  engine (`backend/services/safety_rules.py`), not a pattern, and is never
  polished by the LLM -- a `contact_care_team` escalation always uses fixed
  safety copy. Post-surgical patients get materially different rules (fever,
  heavy bleeding, pain rising after a quiet recovery stretch) from everyone
  else (sustained severe pain, fever).
- Every pattern requires a minimum number of comparable data points
  (currently 3) before it will be generated at all, to avoid inventing a
  pattern from single-day noise -- see Mei's "insufficient data, keep
  logging" state, which also never generates follow-up questions.
- Every pattern decision, follow-up question, follow-up answer, and
  escalation shown to a patient is written to an append-only audit log
  (`GET /audit-log`) with timestamp, rule version, evidence count, and the
  exact text displayed.
- This is a hackathon MVP built entirely on synthetic data. It is not a
  medical device and has not been clinically validated.

## Project structure

```text
backend/
  app.py                        # FastAPI app + routes
  models.py                     # Pydantic v2 models (source of truth for all data shapes)
  data/mock_patients.json       # Synthetic 3-patient dataset (Priya, Mei, Sam)
  services/
    timeline_builder.py         # Merges daily + wearable logs into one chronological timeline
    pattern_engine.py           # Deterministic pattern detection (no LLM)
    safety_rules.py             # Conservative, rules-based escalation (never HRV alone)
    ai_coach.py                 # LLM follow-up questions + explanation/next-step wording, with deterministic fallback
    clinician_summary.py        # Journey-stage-adapted, exportable clinician summary
    language_guard.py           # Association-only / non-diagnostic / non-medication phrase check
    audit_log.py                # Append-only in-memory audit trail
    voice_checkin.py            # Demo-safe transcript -> draft DailyLog extraction for the voice check-in flow
  tests/
    test_pattern_engine.py      # Covers the Phase-2 checkpoint list end to end
    test_ai_coach.py            # AI-layer guardrails: question count, safety, escalation bypass
    test_api.py                 # End-to-end API tests for the Phase 3 endpoints
    test_voice_checkin.py       # Voice check-in extraction + endpoint tests
frontend/
  src/
    api.ts                      # Fetch client + types mirroring backend/models.py exactly
    context/PatientContext.tsx  # Selected demo patient, shared across pages
    lib/labels.ts                # Journey-stage / pattern-type / confidence copy, in one place
    pages/Today.tsx              # Quick log, latest pattern status, one pending question, voice check-in toggle
    pages/MyPatterns.tsx         # Pain-trend chart (Recharts) + pattern cards with evidence
    pages/ShareSummary.tsx       # Printable/exportable clinician summary
    pages/JourneyStage.tsx       # Journey stage picker -- revisable any time
    components/DailyLogForm.tsx  # <30s daily log (pain, location, type, GI, fatigue, sleep, safety flags)
    components/VoiceCheckIn.tsx  # Accessible spoken/typed check-in -- drafts a DailyLog for review before saving
    components/PatternCard.tsx   # Plain-language pattern + confidence badge + accept/dismiss feedback
    components/EvidenceDrawer.tsx # Exact evidence points + baseline note + rule version
requirements.txt
```

## Running locally

```bash
python -m venv .venv
.venv/Scripts/activate        # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt

cd backend
python -m uvicorn app:app --reload
```

The API is then live at `http://127.0.0.1:8000` (interactive docs at `/docs`).

To enable real LLM-phrased follow-up questions and explanations, set
`ANTHROPIC_API_KEY` before starting the server (optionally `ENDO_LOOP_LLM_MODEL`
to override the default `claude-opus-4-8`). Without it, every AI-layer call
falls back to its deterministic template automatically -- the demo works
either way.

In a second terminal, start the frontend:

```bash
cd frontend
npm install
npm run dev
```

The app is then live at `http://localhost:5173`. The Vite dev server proxies
`/api/*` to the backend at `http://127.0.0.1:8000` (see `frontend/vite.config.ts`),
so no CORS configuration or hardcoded backend URL is needed.

### Running the tests

```bash
cd backend
pytest
```

Tests that exercise the AI layer explicitly unset any Anthropic credentials
first, so the suite is fast, free, and deterministic regardless of what's in
your shell environment.

```bash
cd frontend
npx tsc -b        # typecheck
npm run build     # production build
```

## Deployment

Split deployment: React frontend on **Vercel** talking to a FastAPI backend
on **Render**, with Claude (Anthropic API) powering the LLM-driven follow-up
question logic. See [TECH_STACK.md](TECH_STACK.md) for the full stack and
[render.yaml](render.yaml) for the backend service config.

## API

| Method | Path | Description |
|---|---|---|
| `GET`   | `/patients` | List all patients (convenience) |
| `POST`  | `/patients/{id}/logs` | Add/replace a daily symptom log |
| `POST`  | `/patients/{id}/voice-check-in` | Extract a draft daily log from a transcript (read-only -- does not save) |
| `POST`  | `/patients/{id}/wearable` | Add/replace a wearable (HRV/HR/temp) log |
| `GET`   | `/patients/{id}/timeline` | Combined chronological timeline |
| `GET`   | `/patients/{id}/patterns` | Deterministic pattern results + evidence + escalation + AI explanation/next-step/follow-up questions |
| `POST`  | `/patterns/{pattern_id}/follow-up` | Save the patient's answer to a follow-up question |
| `GET`   | `/patients/{id}/clinician-summary` | Journey-stage-adapted, exportable summary (patterns, evidence, follow-up Q&A) |
| `PATCH` | `/patients/{id}/journey-stage` | Update the patient's selected journey stage |
| `GET`   | `/audit-log` | Full append-only audit trail |

## Demo data

Three synthetic patients, one per journey stage, in `backend/data/mock_patients.json`:

- **Priya (P001)**, diagnosed & managing -- 14 days of logs; pain climbs from
  3 to 7 over the last 5 days on cycle days 15-19 (outside her typical
  day 1-5 pain window), with HRV dropping alongside it every one of those
  days and sleep dropping from 6.5h to 4.5h. `GET /patients/P001/patterns`
  returns both the `escalating_pain` and `hrv_autonomic_cosignal` signals, a
  `watch`-level escalation, an AI-phrased explanation and next step, and up
  to two follow-up questions.
- **Mei (P002)**, exploring/undiagnosed -- a single day of logs.
  `GET /patients/P002/patterns` returns only an `insufficient_data` signal
  ("keep logging"), never an invented pattern, and no follow-up questions.
- **Sam (P003)**, post-surgical -- 13 days of logs; pain declines from 8 to 3
  in the first week (expected recovery), plateaus, then rises to 6 with a
  fever logged on the final day. `GET /patients/P003/patterns` returns a
  `post_surgical_plateau` signal labeled "worsening" and a
  `contact_care_team` escalation -- a rule that is structurally distinct
  from, and never overlaps with, the general `escalating_pain` rule, and
  whose safety copy is never sent through the LLM.

## Frontend

Four mobile-first screens (React + Vite + Tailwind + Recharts), navigable via
the bottom tab bar, with a patient switcher in the header for the demo (no
auth -- a real deployment would replace this with a logged-in patient):

- **Today** -- the daily log (a tap-friendly 0-10 pain scale, location, type,
  bleeding/fever/medication toggles, GI symptoms, fatigue, a +/- sleep-hours
  stepper, cycle day), the latest AI-phrased pattern status and safe next
  step, any active safety escalation banner, and one pending follow-up
  question to answer inline. A **Voice check-in** toggle (also reachable via
  the floating **Talk to Endo Loop** button) offers an accessible
  alternative: speak -- continuously, through natural pauses, no need to
  re-tap the mic -- or type, across as many turns as needed ("Continue
  conversation" accumulates what's been said so far). On each turn,
  `backend/services/voice_checkin.py` -- a deterministic regex/keyword
  parser, not an LLM -- extracts a draft `DailyLog` from the full
  conversation so far, lists any missing details, and asks up to two
  follow-up questions. The draft is always shown for review before
  `POST /patients/{id}/logs` actually saves it, so the normal pattern engine
  and safety rules run over it exactly as they would over a manually-typed
  log. Originally built by Vossco Nguyen on a parallel branch and ported
  into this build's architecture, including the rose color theme.
- **My Patterns** -- a pain-over-time chart (Recharts) plus a card per
  pattern with its plain-language message, a confidence badge, and an
  evidence drawer showing the exact data points and baseline comparison
  behind it. Each card has "accept / not typical / dismiss" buttons.
  **This feedback is UI-only** (session-local React state) -- there's no
  backend endpoint for it yet, since the spec's "Learn" loop step (baselines
  adjusting from confirmed feedback) is out of scope for this MVP. It's
  wired up as a control surface for a judge or future iteration to see the
  intended interaction, not a persisted signal.
- **Share with my care team** -- the journey-stage-adapted clinician summary,
  exportable via a "Copy as text" button or the browser's print dialog
  (`window.print()`, with a print stylesheet that hides navigation chrome).
- **Journey Stage** -- the four-stage picker (`exploring`, `suspected_undiagnosed`,
  `diagnosed_managing`, `post_surgical`), explicitly framed as patient-authored
  context rather than a diagnosis, revisable any time via `PATCH /patients/{id}/journey-stage`.

### Demo flow

1. Open the app with **Priya** selected (default). Today shows a `watch`
   escalation, the AI explanation of her pain+HRV pattern, and a follow-up
   question -- answer it, then check My Patterns for the evidence drawer and
   the pain chart.
2. Switch to **Journey Stage** and toggle Priya between stages live -- the
   same underlying data now produces different wording and next-step
   framing (compare `diagnosed_managing` vs `exploring` phrasing on Today).
3. Switch to **Mei** -- Today shows the "not enough data yet, keep logging"
   state with no escalation and no follow-up question.
4. Switch to **Sam** -- Today shows a `contact_care_team` escalation (fixed
   safety copy, not LLM-polished) and My Patterns shows the decline-then-rise
   shape of his post-surgical plateau on the pain chart.
5. Visit **Share with my care team** for any patient and export the summary.

## Checkpoint verified (Phase 2)

- [x] Mock data loads and validates with Pydantic.
- [x] Pain-trend pattern requires 3+ consecutive comparable data points.
- [x] HRV co-signal only fires alongside a concurrent pain trend, never on HRV alone.
- [x] Post-surgical plateau logic is distinct from the general escalating-pain rule.
- [x] Every pattern displays its exact evidence and sample count.
- [x] Language is association-only -- no causal or diagnostic phrasing anywhere in output.
- [x] Mei (sparse data) receives an "insufficient data, keep logging" state, not an invented pattern.

See `backend/tests/test_pattern_engine.py` for the automated version of this list.

## Checkpoint verified (Phase 3)

- [x] The LLM runs only after the local engine creates a `PatternSignal`; it never decides whether a pattern exists.
- [x] At most two follow-up questions, and none at all for the insufficient-data state.
- [x] Explanation, next-step, and follow-up-question text are all association-only and non-diagnostic -- checked via `language_guard.is_safe()`.
- [x] The safe next step stays behavioral/self-care and never proposes a medication or dose change.
- [x] A `contact_care_team` escalation always uses fixed safety copy, never LLM-polished wording.
- [x] The app runs correctly with no `ANTHROPIC_API_KEY` set -- every AI-layer call degrades to its deterministic template.
- [x] Every follow-up question and answer is written to the append-only audit log.

See `backend/tests/test_ai_coach.py` and `backend/tests/test_api.py` for the automated version of this list.

## Checkpoint verified (Phase 4)

Manually verified end to end against the live backend (production build, `npx tsc -b`, and a scripted browser walkthrough at a 390px mobile viewport all pass with zero console errors):

- [x] A daily log can be filled in and submitted in well under 30 seconds (chip-based multi-select, one required field).
- [x] Priya's escalating-pain + HRV-cosignal pattern renders with its evidence drawer, confidence label, and pain-over-time chart.
- [x] The evidence drawer shows the *exact* data points (dates, labels, values) behind a pattern, not a summary.
- [x] The AI asks at most two follow-up questions on Today, answerable inline, and the answer shows up in the clinician summary afterward.
- [x] Toggling journey stage on the Journey Stage screen visibly changes Today's wording for identical underlying data.
- [x] Mei's insufficient-data state renders with no escalation banner and no follow-up question.
- [x] Sam's `contact_care_team` escalation renders with the fixed safety banner, and his pain chart visually shows the decline-then-plateau-then-rise shape.
- [x] The clinician summary is exportable via print and via copy-to-text.
- [x] No diagnosis, staging claim, or causal language appears anywhere in the rendered UI (same guarantee as the API, since the UI only ever displays API-provided text verbatim).

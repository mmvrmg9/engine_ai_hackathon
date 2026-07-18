# ENDO LOOP: CODEX BUILD PROMPT
## eMed Hackathon — Team MVP (Fri 7pm – Sat 3pm)

---

## CONTEXT

**Problem:** Endometriosis takes an average of 7 years to diagnose. Symptoms are dismissed because no single clinic visit can see the pattern — pain that builds over days, recovery that doesn't bounce back, cycles that don't behave the way anyone expects. Patients already log data across period apps, wearables, and notes apps, but nothing connects it into something a clinician can act on in the time they actually have.

**Solution:** Endo Loop is an AI-supported at-home pattern layer for endometriosis and chronic pelvic pain. It combines pain, cycle, sleep, and autonomic (HRV) data into transparent, plain-language observations, one safe next step, and a clinician-ready summary — adapted to where the patient actually is in their care journey (exploring symptoms, suspected, diagnosed, or post-surgical).

**Key principle:** This is not a diagnostic tool. It never says "this is endometriosis" or "this is central sensitization." It surfaces **possible patterns**, shows the evidence behind them, asks the patient to confirm context, and helps them prepare a better conversation with their clinical team.

**Hackathon Challenge:** eMed | "At-home chronic condition management powered by AI"

---

## PRODUCT LOOP

```text
Sense → Understand → Ask → Act → Learn → Escalate
```

1. **Sense:** Patient logs pain (score, location, type), cycle day, sleep, GI symptoms, medication — and imports HRV/resting HR/temperature from a wearable (or synthetic feed for demo).
2. **Understand:** Local deterministic rules detect trends — pain escalating over consecutive days, HRV dropping alongside rising pain, patterns falling outside the patient's usual cycle window.
3. **Ask:** AI asks at most two clinically meaningful follow-up questions (e.g. "Is this pain similar to your period pain, or different?").
4. **Act:** Patient receives a plain-language explanation, a safe non-diagnostic next step, and (if relevant) a clinician-ready summary — all shaped by their selected journey stage.
5. **Learn:** Confirmed context and outcomes refine the patient's personal baseline for future cycles.
6. **Escalate:** Conservative, rules-based safety flags (never HRV alone) surface a "contact your care team" prompt — language and thresholds differ for post-surgical patients (fever, escalating pain after a quiet period) vs. others.

---

## JOURNEY STAGE (Core Differentiator)

On onboarding, patient selects **"Where are you in your journey?"** — revisable any time, framed as patient-authored context, never a locked diagnosis:

| Stage | What changes |
|---|---|
| **Exploring** | Output favors evidence-building for a first clinical conversation; language stays maximally cautious |
| **Suspected, undiagnosed** | Same evidence-building focus, still conservative escalation |
| **Diagnosed, managing** | Full loop active — treatment adherence, symptom-management content, personal baseline learning |
| **Post-surgical** | Different signal entirely: expects pain trending *down*; flags plateau/worsening after initial improvement and post-op safety symptoms (fever, heavy bleeding, escalating pain after a quiet period) |

---

## TECH STACK

- **Backend:** FastAPI + Pydantic v2
- **Frontend:** React + Vite + Tailwind CSS (mobile-first)
- **AI:** LLM (via Anthropic/OpenAI API) for follow-up questions, plain-language explanations, and clinician-summary wording only
- **Pattern detection:** Local deterministic heuristics — **no LLM decides whether a pattern exists**
- **Data:** Synthetic JSON only, including a 2-week synthetic wearable trace (HRV, resting HR, sleep, temperature) — no live device integration required for the demo
- **Charts:** Recharts
- **Audit log:** Append-only log of every pattern, its evidence, and the exact patient-facing text shown

---

## MVP SCOPE

### Phase 1: Mock Data + Logging (Hours 1–3)

- Create synthetic data for 3 patients across different journey stages (see below).
- Fast structured logging: pain (score 0–10, location, type), cycle day, bleeding, GI symptoms, fatigue, sleep hours, medication taken.
- Simulated wearable feed: daily HRV, resting HR, skin temperature.
- Output: validated combined timeline per patient.

### Phase 2: Deterministic Pattern Engine (Hours 3–8)

Implement local rules that detect *possible patterns*, not causes or diagnoses.

- **Escalating pain trend:** 3+ consecutive days of rising pain score outside the patient's typical cycle-linked window.
- **Autonomic co-signal:** HRV trending down (vs. patient's own 7-day rolling baseline) concurrent with rising pain/poor sleep — always phrased as a **trend observation**, never a diagnostic claim (see safety language below).
- **Post-surgical plateau/worsening:** for post-surgical stage, flag pain plateauing or increasing after an initial declining trend.
- Require a minimum number of comparable data points before generating a pattern card (avoid single-data-point noise).
- Output a structured `PatternSignal` object: evidence points, patient's own baseline, sample count, confidence label, journey-stage-appropriate safe wording.
- **Never** output causal language ("your HRV shows central sensitization") — only "your recovery signal and pain have moved together over the last N days."

### Phase 3: AI Conversation + Journey-Adapted Output (Hours 8–12)

- LLM runs only after the local engine creates a `PatternSignal`.
- Generate 1–2 targeted follow-up questions (pain-location/quality differentiators, typical vs. atypical bleeding, etc.).
- Generate the four required outputs, templated per journey stage:
  - Plain-language explanation
  - Safe next-step recommendation (non-diagnostic; behavioral/self-care register — sleep, pacing, contacting care team; never medication dosing advice)
  - Clinician-ready summary (structured, dated, exportable)
  - Escalation flag (rules-based, conservative, journey-stage-aware)
- System constraints for the LLM:
  - No diagnosis, no staging claims, no medication changes
  - Use "may be associated with" / "worth discussing," never "caused by" or "this means you have..."
  - HRV is described only as a personal trend signal, explicitly not a stand-alone marker of pain severity
  - Concerning symptoms route to "contact your clinical team," never to an in-app risk score

### Phase 4: Patient Experience (Hours 12–16)

Three mobile-first screens:

1. **Today** — quick log, latest pattern status, one pending question
2. **My Patterns** — plain-language pattern cards with an evidence drawer (exact data points, baseline comparison, confidence), accept/dismiss/"not typical" feedback
3. **Share with my care team** — one-page exportable summary: pattern, evidence, patient feedback, questions for review — shaped by journey stage

### Phase 5: Demo Narrative + Audit (Hours 16–18)

- Primary journey: **Priya**, diagnosed and managing, logs 3 days of rising pain outside her cycle window alongside dropping HRV and poor sleep. App asks two questions, generates explanation + safe next step + clinician summary.
- Secondary: **Mei**, exploring/undiagnosed — same engine, output focused entirely on evidence-building language for a first appointment.
- Tertiary: **Sam**, post-surgical — pain plateaus after initial improvement, triggers the post-op-specific escalation flag.
- Log every pattern decision with timestamp, input IDs, rule version, evidence count, and exact displayed text.

---

## MOCK DATA SCHEMA

```json
{
  "patients": [
    {
      "id": "P001",
      "name": "Priya",
      "journey_stage": "diagnosed_managing",
      "preferences": {
        "goals": ["fewer unpredictable flares", "clearer conversations with GP"]
      },
      "daily_logs": [
        {
          "date": "2026-07-14",
          "cycle_day": 19,
          "pain_score": 7,
          "pain_location": "lower_left_pelvic",
          "pain_type": "cramping",
          "bleeding": false,
          "gi_symptoms": ["bloating"],
          "fatigue": "high",
          "sleep_hours": 4.5,
          "medication_taken": false
        }
      ],
      "wearable_logs": [
        {
          "date": "2026-07-14",
          "hrv_ms": 32,
          "hrv_baseline_ms": 41,
          "resting_hr": 74,
          "skin_temp_delta_c": 0.3
        }
      ]
    }
  ]
}
```

Create at least:
- **Priya:** clear escalating pain + HRV co-signal (main demo)
- **Mei:** exploring stage, single-day data — shows "keep logging, here's a starter clinician summary" state
- **Sam:** post-surgical plateau pattern — shows the stage-specific escalation logic working differently

---

## API CONTRACT

- `POST /patients/{id}/logs` — add a daily symptom/context log
- `POST /patients/{id}/wearable` — add HRV/HR/temperature entry
- `GET /patients/{id}/timeline` — combined chronological view
- `GET /patients/{id}/patterns` — deterministic pattern results with evidence
- `POST /patterns/{id}/follow-up` — save patient's answer to a follow-up question
- `GET /patients/{id}/clinician-summary` — journey-stage-adapted shareable summary
- `PATCH /patients/{id}/journey-stage` — update stage selection
- `GET /audit-log` — demo audit trail

---

## PROJECT STRUCTURE

```text
backend/
  app.py
  models.py
  data/mock_patients.json
  services/
    timeline_builder.py
    pattern_engine.py
    safety_rules.py
    ai_coach.py
    clinician_summary.py
    audit_log.py
frontend/
  src/
    pages/Today.tsx
    pages/MyPatterns.tsx
    pages/ShareSummary.tsx
    pages/JourneyStage.tsx
    components/DailyLogForm.tsx
    components/PatternCard.tsx
    components/EvidenceDrawer.tsx
README.md
requirements.txt
```

---

## DELIVERABLES

### Code
- Working FastAPI API with deterministic pattern detection (pain trend, HRV co-signal, post-surgical plateau)
- React patient experience: Today, My Patterns, Share Summary, Journey Stage screens
- Synthetic three-patient dataset covering all journey stages
- LLM-powered follow-up questions and output wording behind safety guardrails
- Append-only audit trail
- README with setup, demo flow, and explicit safety/non-diagnostic limitations

### Demo Ready
- Priya logs symptoms, sees an escalating pain + HRV pattern with visible evidence, answers a follow-up question, gets a clinician summary.
- Mei's exploring-stage output shows appropriately cautious, evidence-building language only.
- Sam's post-surgical plateau triggers the stage-specific escalation flag.
- Judges can toggle journey stage live to see how identical underlying data produces different, appropriately calibrated output.

### Narrative
> "Endo Loop doesn't diagnose — it notices what a single appointment can't: the pattern across days, calibrated to where you actually are in your care journey, and puts it in front of you and your clinician in language grounded in real evidence, not assumption."

---

## STARTING PROMPT (FOR CODEX)

> Build the Endo Loop MVP for the eMed hackathon.
>
> Start with Phase 1 and Phase 2 only:
> - Create FastAPI + Pydantic models for patients, daily symptom logs, wearable logs, journey stage, and pattern signals.
> - Add mock data for Priya (diagnosed, escalating pain + HRV co-signal), Mei (exploring, single day of data), and Sam (post-surgical, pain plateau after initial improvement).
> - Build a deterministic pattern engine that detects: (a) 3+ consecutive days of rising pain outside the typical cycle window, (b) HRV trending below the patient's own rolling baseline concurrent with rising pain, (c) for post-surgical patients only, pain plateauing or rising after an initial decline.
> - Every pattern must return its exact evidence, sample count, confidence label, and journey-stage-appropriate neutral wording. Do not use an LLM for pattern detection — deterministic rules only.
> - Never output causal or diagnostic language. Use "may be associated with," never "caused by" or "this means."
>
> Keep the code modular and use synthetic data only.
>
> First milestone: `GET /patients/P001/patterns` returns Priya's pain+HRV pattern with evidence; `GET /patients/P002/patterns` returns Mei's "insufficient data" state; `GET /patients/P003/patterns` returns Sam's post-surgical plateau flag.

---

## CHECKPOINT: AFTER PHASE 2

Before adding AI or frontend work, verify:

- [ ] Mock data loads and validates with Pydantic.
- [ ] Pain-trend pattern requires 3+ consecutive comparable data points.
- [ ] HRV co-signal only fires alongside a concurrent pain trend, never on HRV alone.
- [ ] Post-surgical plateau logic is distinct from the general escalating-pain rule.
- [ ] Every pattern displays its exact evidence and sample count.
- [ ] Language is association-only — no causal or diagnostic phrasing anywhere in output.
- [ ] Mei (sparse data) receives an "insufficient data, keep logging" state, not an invented pattern.

If any fail, fix the deterministic engine before adding the LLM layer.

---

## SUCCESS CRITERIA

- [ ] Patient can log a day's symptoms in under 30 seconds.
- [ ] Priya's escalating pattern is detected reproducibly from synthetic data.
- [ ] UI visibly explains *why* each pattern was shown (evidence drawer).
- [ ] AI asks no more than two relevant follow-up questions.
- [ ] Journey stage selection visibly changes output tone/content for identical underlying data.
- [ ] No diagnosis, staging claim, or unsupported causal claim appears anywhere.
- [ ] Post-surgical escalation logic is distinct and demonstrably different from general flare escalation.
- [ ] Clinician summary is concise, evidence-backed, and exportable.
- [ ] Code is modular, readable, and runnable locally.

---

## RUNNING LOCALLY

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app:app --reload

# In another terminal:
cd frontend
npm install
npm run dev
```

---

## GO BUILD

Build the pattern-and-safety loop first. A single, well-evidenced pattern for Priya that respects journey stage and never overclaims is more persuasive to judges than a broad dashboard nobody can trust.

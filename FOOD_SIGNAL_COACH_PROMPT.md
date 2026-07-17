# FOOD SIGNAL COACH: CLAUDE CODE BUILD PROMPT
## eMed x OpenAI Hackathon (17–18 July 2026) — 3-Person Team MVP

---

## CONTEXT

**Problem:** People managing type 2 diabetes at home receive generic nutrition advice, yet their response to meals can be highly personal. Meal logs, glucose readings, medication adherence, activity, sleep, and symptoms are usually scattered and hard to interpret. Patients are left asking: *“What can I realistically change at my next meal?”*

**Solution:** Food Signal Coach is an AI-supported at-home pattern finder. It turns quick meal logging and at-home health data into transparent, plain-language observations, one achievable food swap, and a clinician-ready summary when a pattern may warrant discussion.

**Key principle:** This is not a diagnostic, medication-adjustment, or autonomous triage tool. It detects **possible associations**, shows the evidence behind them, asks the patient to confirm context, and helps them prepare better conversations with their clinical team.

**Hackathon Challenge:** eMed | “At-home chronic condition management powered by AI” | AI Engine, London, 17–18 July 2026

---

## PRODUCT LOOP

```text
Sense → Understand → Ask → Act → Learn → Share / Escalate
```

1. **Sense:** Patient logs a meal in seconds (photo or text) and imports/enters a glucose reading.
2. **Understand:** Local rules group comparable meals and readings, accounting for timing and basic context.
3. **Ask:** AI asks at most two useful questions, such as “Was this portion typical?” or “Did you exercise after this meal?”
4. **Act:** Patient gets one non-prescriptive, low-friction food swap.
5. **Learn:** Patient marks whether the suggestion felt feasible; future suggestions respect preferences and constraints.
6. **Share / Escalate:** A concise evidence-based summary is available for a clinician. Safety concerns are presented as “contact your clinical team / follow your care plan,” never as a diagnosis.

---

## TECH STACK

- **Backend:** FastAPI + Pydantic v2
- **Frontend:** React + Vite + Tailwind CSS (mobile-first patient experience)
- **AI:** OpenAI GPT-4o for meal-text extraction, follow-up questions, explanations, and suggestion wording
- **Pattern detection:** Local deterministic heuristics — no LLM used to decide whether a pattern exists
- **Data:** Synthetic JSON only; no real patient data or external clinical APIs
- **Charts:** Recharts (or a lightweight equivalent)
- **Deployment:** Render (backend) + Vercel (frontend), if time permits
- **Audit log:** Append-only JSON/in-memory log of each pattern, its evidence, and the displayed patient message

---

## MVP SCOPE (18-Hour Build)

### Phase 1: Mock Data + Meal Logging (Hours 1–3)

- Create mock data for 3 patients with 2 weeks of meals and at-home readings.
- Support a fast text meal log; do **not** make image recognition a dependency for the demo.
- Store meal time, food tags, estimated portion, and optional context: activity, sleep, medication taken, symptoms.
- Create a structured meal object using a small, transparent food-tag taxonomy:
  - `refined_carbohydrate`, `high_fibre`, `protein_source`, `vegetables`, `sugary_drink`, `processed_food`
- Output: validated patient timeline combining meals, glucose readings, and context.

### Phase 2: Deterministic Food-Signal Engine (Hours 3–7)

Implement a local rules engine that identifies *possible patterns*, not causes.

- Match each meal to the nearest post-meal reading within a configurable window (e.g. 1–3 hours).
- Group meals by tag and meal type (breakfast / lunch / dinner).
- Require at least 3 comparable observations before creating a pattern card.
- Calculate:
  - average post-meal reading for the group
  - patient’s own baseline / overall average
  - difference from baseline
  - sample count and simple confidence label
- Only produce a pattern when a group has sufficient data and exceeds a conservative configurable threshold.
- Create neutral language, for example:
  - “In 4 similar breakfasts, readings were higher than your usual post-meal range.”
  - Never: “Cereal caused your glucose spike.”
- Output: structured `FoodSignal` object with evidence, confidence, confounders, and safe wording.

### Phase 3: AI Conversation + Personalised Swap (Hours 7–10)

- Use GPT-4o only after the local engine has created a `FoodSignal`.
- Generate one or two short follow-up questions based on missing context.
- Generate a single practical suggestion, constrained by:
  - patient food preferences and dietary restrictions
  - allergies
  - budget / available ingredients
  - cultural food preferences
- Example:
  - Observation: “Sweet cereal breakfasts appeared alongside higher readings in 4 comparable logs.”
  - Follow-up: “Was the portion larger than usual?”
  - Suggestion: “If it suits you, try oats with Greek yogurt and berries on two mornings this week, then compare your readings.”
- LLM system constraints:
  - no diagnosis, medication changes, insulin dosing, or emergency assessment
  - say “may be associated with,” not “caused by”
  - present an experiment the patient can accept, dismiss, or modify
  - refer concerning symptoms/readings to the patient’s existing care plan or clinical team

### Phase 4: Patient Experience + Clinician Summary (Hours 10–15)

Build three mobile-first screens:

1. **Today**
   - Quick meal log
   - Latest reading
   - One next action / pending question

2. **My Food Signals**
   - Plain-language signal cards
   - “Why am I seeing this?” evidence drawer: 4 meal dates, readings, comparison baseline, confidence
   - Accept / dismiss / “not typical” feedback
   - Suggested low-friction swap

3. **Share with my care team**
   - One-page summary: observed pattern, evidence, patient feedback, context flags, and questions for review
   - Download/copy text is sufficient; no EHR integration

### Phase 5: Demo Narrative + Auditability (Hours 15–18)

- Create one polished primary journey: **Aisha**, living with type 2 diabetes.
- Aisha logs four similar sweet-cereal breakfasts, each followed by a higher-than-usual reading.
- The system asks whether those were typical portions and whether she exercised afterwards.
- It explains the observed association, suggests a realistic alternative, and allows Aisha to start a two-breakfast experiment.
- A clinician summary makes the observation reviewable without requiring a real-time appointment.
- Log every pattern decision with timestamp, input IDs, rule version, evidence count, and patient-facing text.

---

## MOCK DATA SCHEMA

```json
{
  "patients": [
    {
      "id": "P001",
      "name": "Aisha",
      "age": 51,
      "conditions": ["Type 2 Diabetes"],
      "preferences": {
        "dietary_requirements": ["halal"],
        "allergies": ["peanuts"],
        "goals": ["steadier glucose", "simple weekday breakfasts"]
      },
      "meal_logs": [
        {
          "id": "M001",
          "datetime": "2026-07-06T08:00:00",
          "meal_type": "breakfast",
          "description": "Sweetened cereal with semi-skimmed milk",
          "tags": ["refined_carbohydrate"],
          "portion": "medium",
          "medication_taken": true,
          "activity_after_meal_minutes": 0
        }
      ],
      "glucose_readings": [
        {
          "id": "G001",
          "datetime": "2026-07-06T10:00:00",
          "value": 11.2,
          "unit": "mmol/L",
          "context": "post_meal"
        }
      ],
      "context_logs": [
        {
          "date": "2026-07-06",
          "sleep_hours": 6.0,
          "stress": "moderate",
          "symptoms": []
        }
      ]
    }
  ]
}
```

Create at least:

- **Aisha:** strong, explainable breakfast pattern (main demo).
- **Ben:** stable readings / no pattern — proves the product does not invent advice.
- **Carla:** insufficient or confounded data — shows a “keep logging; we need more comparable meals” state.

---

## API CONTRACT

- `POST /patients/{id}/meals` — add a text meal log
- `POST /patients/{id}/readings` — add an at-home reading
- `GET /patients/{id}/timeline` — chronological meals, readings, and context
- `GET /patients/{id}/food-signals` — deterministic pattern results with evidence
- `POST /food-signals/{id}/follow-up` — save patient answer / feedback
- `GET /patients/{id}/clinician-summary` — safe, concise sharing summary
- `GET /audit-log` — display demo audit events

---

## PROJECT STRUCTURE

```text
backend/
  app.py
  models.py
  data/mock_patients.json
  services/
    timeline_matcher.py
    food_signal_engine.py
    safety_rules.py
    ai_coach.py
    clinician_summary.py
    audit_log.py
frontend/
  src/
    pages/Today.tsx
    pages/FoodSignals.tsx
    pages/ShareSummary.tsx
    components/MealLogForm.tsx
    components/FoodSignalCard.tsx
    components/EvidenceDrawer.tsx
README.md
requirements.txt
```

---

## DELIVERABLES (END OF 18 HOURS)

### Code

- Working FastAPI API with deterministic meal-to-reading matching and signal detection
- React patient experience with Today, Food Signals, and Share Summary screens
- Synthetic three-patient data set
- OpenAI-powered follow-up questions and suggestion wording behind safety guardrails
- Append-only audit trail
- README with setup, demo flow, and safety limitations

### Demo Ready

- Aisha logs a breakfast and sees her timeline.
- The app reveals a signal based on four comparable meals, with evidence visible.
- She answers one contextual question and accepts a simple two-breakfast experiment.
- Judges see a clinician-ready summary generated from the same evidence.
- Ben demonstrates that no signal appears when no reliable pattern exists.

### Narrative

> “Patients do not need another food diary. They need a coach that helps them understand their own data, make one achievable change, and bring meaningful patterns to their clinical team.”

---

## STARTING PROMPT (FOR CLAUDE CODE)

> Build the Food Signal Coach MVP for the eMed x OpenAI Hackathon.
>
> Start with Phase 1 and Phase 2 only:
> - Create FastAPI + Pydantic models for patients, meal logs, glucose readings, context logs, and food signals.
> - Add mock data for Aisha, Ben, and Carla.
> - Build a deterministic timeline matcher that links meals to the nearest post-meal reading within 1–3 hours.
> - Build a deterministic Food Signal engine that groups comparable meals and emits a possible association only with at least 3 observations.
> - Return evidence, patient baseline, sample count, confidence, and neutral wording. Do not use an LLM for pattern detection.
>
> Keep the code modular and use synthetic data only. Do not make medical diagnoses, medication changes, or claims of causality.
>
> First milestone: `GET /patients/P001/food-signals` returns Aisha’s explainable breakfast signal and `GET /patients/P002/food-signals` returns no signal.

---

## CHECKPOINT: AFTER PHASE 2 (HOUR 7)

Before adding AI or frontend work, verify:

- [ ] Mock data loads and validates with Pydantic.
- [ ] Meals are matched only to readings in the configured post-meal window.
- [ ] A signal requires at least three comparable observations.
- [ ] Every signal displays its exact evidence and sample count.
- [ ] The system uses association language, never causal or diagnostic language.
- [ ] Ben receives no invented signal; Carla receives an insufficient-data explanation.

If any fail, fix the deterministic engine before adding GPT-4o.

---

## SUCCESS CRITERIA (18-HOUR DEMO)

- [ ] Patient can log a meal in under 20 seconds.
- [ ] Aisha’s breakfast pattern is detected reproducibly from synthetic data.
- [ ] The UI visibly explains *why* the pattern was shown.
- [ ] AI asks no more than two relevant follow-up questions.
- [ ] Suggestion is practical and respects stated restrictions.
- [ ] No diagnosis, dosing advice, or unsupported causal claim is shown.
- [ ] Clinician summary is concise, evidence-backed, and shareable.
- [ ] Code is modular, readable, and runnable locally.

---

## RUNNING LOCALLY (AFTER BUILD)

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

Build the evidence loop first. A polished, safe, personalised insight for one patient is more persuasive than a broad dashboard with unexplainable recommendations.

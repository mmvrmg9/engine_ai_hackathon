# FOOD SIGNAL COACH: eMED HACKATHON BUILD PROMPT
## eMed x OpenAI Hackathon — At-Home Chronic Condition Management Powered by AI

---

## THE IDEA

Build **Food Signal Coach**, a feature inside the eMed app for people managing type 2 diabetes and related metabolic conditions at home.

Patients log meals during the week using a photo or a short text description. The feature compares meal patterns with their weekly at-home biomarker results, such as glucose readings, weight, blood pressure, and symptom check-ins. It identifies **possible personal associations** between recurring meal patterns and the patient’s results, then suggests practical alternatives that suit the person’s lifestyle.

The core patient question is:

> “Which foods or meal patterns may not be working well for my body — and what is one realistic thing I can try instead?”

This is not a generic calorie counter or another food diary. It is an AI-powered, explainable feedback loop that turns fragmented home data into one useful next action.

---

## WHY THIS FITS eMED

eMed has shown that long-term conditions can be managed successfully at home when people have the right tools and ongoing support. Food Signal Coach extends that model between appointments:

- **Makes adherence easier:** it turns nutrition advice into one small, personalised action rather than a restrictive plan.
- **Feels human:** it asks short, relevant questions when context is missing instead of lecturing patients.
- **Uses at-home data:** it connects food logs with the readings a patient already records at home.
- **Supports clinical teams asynchronously:** clinicians receive an evidence-backed summary rather than raw meal logs.
- **Builds patient agency:** people learn what works for *their* routine, culture, preferences, and budget.

---

## PRODUCT LOOP

```text
Log a meal → Link it to at-home results → Find a possible pattern
        → Ask for missing context → Suggest one achievable swap
        → Learn from patient feedback → Share a concise summary with the care team
```

### 1. Log

The patient takes a meal photo or types a quick description:

> “Sweet cereal with milk”

The AI extracts a simple, editable description and tags, for example:

`breakfast`, `refined carbohydrate`, `low fibre`, `dairy`

The patient is never asked to count every calorie or weigh every ingredient.

### 2. Link

The app connects meals to relevant at-home results:

- post-meal glucose readings, where available
- weekly glucose trend / check-in
- weekly weight or blood-pressure check-in
- medication adherence
- activity, sleep, symptoms, illness, and portion-size context

### 3. Find a signal

The app uses deterministic rules to detect a **possible association** only after enough comparable observations. It shows the evidence clearly:

> “In 4 similar breakfast logs this week, your readings were higher than your usual post-meal range.”

It must never claim that a food “caused” a result or that it has diagnosed a condition.

### 4. Ask

Before giving advice, AI asks at most two useful questions:

- “Was this portion typical for you?”
- “Did you do any activity after breakfast?”
- “Was this a usual week for sleep, stress, or illness?”

### 5. Act

The patient receives one low-friction, non-prescriptive alternative:

> “If it works for you, try oats with Greek yogurt and berries for two breakfasts next week, then compare how you feel and what your readings show.”

Suggestions must respect allergies, cultural preferences, dietary requirements, cost, and what is realistically available.

### 6. Share

When the patient chooses, the app generates a clinician-ready summary:

> “Possible pattern observed across 4 comparable sweet-cereal breakfasts. Patient reports portions were typical and no post-meal activity. Suggested a two-breakfast food experiment. Review if pattern persists.”

The clinician sees the evidence, not an opaque AI conclusion.

---

## SAFETY AND TRUST BOUNDARIES

Food Signal Coach is a coaching and communication feature, not an autonomous clinical decision maker.

- Use phrases such as **“may be associated with,” “possible pattern,”** and **“based on 4 comparable meals.”**
- Never diagnose diabetes complications, prescribe food as treatment, change medication, recommend insulin doses, or advise stopping medication.
- Never claim causality from a small number of observations.
- Always show the number of observations, dates, readings, and missing/confounding context.
- When a patient reports concerning symptoms or results, prompt them to follow their existing care plan or contact their clinical team; do not provide an emergency assessment.
- Use synthetic demo data only.

---

## TECH STACK

- **Frontend:** React + Vite + Tailwind CSS, designed as an eMed mobile-app feature
- **Backend:** FastAPI + Pydantic v2
- **AI:** OpenAI GPT-4o for meal interpretation, follow-up questions, plain-language explanations, and food-swap wording
- **Pattern engine:** local deterministic Python rules; do not use an LLM to decide whether a signal exists
- **Charts:** Recharts or lightweight SVG charts
- **Data:** synthetic JSON data only
- **Auditability:** append-only JSON/in-memory audit log for all pattern decisions

---

## MVP SCOPE (18-HOUR BUILD)

### Phase 1 — Patient Timeline and Meal Logging (Hours 1–3)

Create mock data for three people with two weeks of:

- meal logs
- at-home glucose readings
- weekly weight and blood-pressure results
- medication adherence
- activity, sleep, symptoms, and portion-size context

Implement a fast text meal log first. Image upload can be a visual enhancement, but must not block the demo.

Use a small transparent tag taxonomy:

```text
refined_carbohydrate | high_fibre | protein_source | vegetables
sugary_drink | processed_food | fruit | home_cooked
```

### Phase 2 — Food-to-Biomarker Signal Engine (Hours 3–7)

Build deterministic, explainable logic:

1. Match a meal with the nearest relevant at-home reading in a configured time window.
2. Group comparable meals by meal type and food tags.
3. Require at least three comparable observations before showing a signal.
4. Compare the group result with the patient’s own baseline.
5. Record confidence as `emerging`, `consistent`, or `insufficient data`.
6. Capture potential confounders such as missed medication, unusually poor sleep, illness, or unusual portion size.

The engine outputs a structured `FoodSignal`, not free text:

```json
{
  "patient_id": "P001",
  "meal_pattern": "sweetened cereal breakfasts",
  "signal_type": "higher_than_personal_baseline",
  "observations": 4,
  "average_reading": 11.0,
  "baseline_reading": 8.2,
  "confidence": "consistent",
  "confounders": ["one low-sleep night"],
  "safe_summary": "In 4 similar breakfast logs, readings were higher than your usual post-meal range."
}
```

### Phase 3 — AI Follow-Up and Practical Alternative (Hours 7–10)

Only after the deterministic engine produces a valid `FoodSignal`, call GPT-4o to:

- ask up to two context-aware follow-up questions
- explain the observed pattern in plain language
- propose one patient-appropriate meal swap or small experiment

Required AI guardrails:

```text
Do not diagnose.
Do not claim food caused a biomarker change.
Do not recommend medication changes or dosing.
Do not use alarmist language.
Use the evidence supplied by the rules engine; never invent observations.
Suggest an optional, achievable experiment rather than a command.
```

### Phase 4 — eMed Feature Experience (Hours 10–15)

Build these screens as an embedded eMed feature.

#### A. Today: “Log a meal”

- photo/text meal entry
- editable AI-generated tags
- latest at-home reading and optional context check-in
- a progress cue: “You have logged 3 breakfasts this week”

#### B. My Food Signals

- one clear signal card, not a crowded dashboard
- visual timeline of meals and readings
- “Why am I seeing this?” evidence drawer with dates, readings, baseline, sample size, and confounders
- `Typical`, `Not typical`, and `Try this swap` feedback options

#### C. My Next Experiment

- one suggested alternative
- patient can accept, edit, or decline it
- simple goal: “Try this for two breakfasts next week”
- show completion, not a medical outcome promise

#### D. Share with My Care Team

- concise clinician summary
- observed pattern, evidence, patient feedback, and unresolved questions
- copy/download is sufficient; no EHR integration needed

### Phase 5 — Demo and Audit Trail (Hours 15–18)

Demonstrate one complete patient journey.

**Aisha**, 51, lives with type 2 diabetes. Over one week, she logs four similar sweet-cereal breakfasts. Each is followed by a higher-than-usual glucose reading. The feature:

1. shows the association and its evidence;
2. asks if portions were typical and whether she exercised afterwards;
3. offers a culturally appropriate, affordable breakfast experiment;
4. records her choice; and
5. creates a clinician-ready summary for an asynchronous review.

Also show:

- **Ben:** stable results and no reliable food signal — prove the app does not make up advice.
- **Carla:** insufficient or heavily confounded data — show a helpful “keep logging; we need more comparable meals” state.

Audit every signal with timestamp, input record IDs, rule version, evidence count, confidence, and displayed wording.

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
        "goals": ["steadier glucose", "simple weekday breakfasts"],
        "budget": "moderate"
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
      "weekly_checks": [
        {
          "date": "2026-07-12",
          "weight_kg": 82.1,
          "systolic_bp": 132,
          "diastolic_bp": 82
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

---

## API CONTRACT

- `POST /patients/{id}/meals` — add meal text/photo metadata and context
- `POST /patients/{id}/readings` — add an at-home biomarker reading
- `GET /patients/{id}/timeline` — meals, readings, weekly checks, and context in chronological order
- `GET /patients/{id}/food-signals` — deterministic pattern results and evidence
- `POST /food-signals/{id}/feedback` — save “typical/not typical”, follow-up answers, and experiment choice
- `GET /patients/{id}/clinician-summary` — concise evidence-backed sharing summary
- `GET /audit-log` — audit events for demo transparency

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
    pages/MyExperiment.tsx
    pages/ShareSummary.tsx
    components/MealLogForm.tsx
    components/FoodSignalCard.tsx
    components/EvidenceDrawer.tsx
README.md
requirements.txt
```

---

## STARTING PROMPT FOR CLAUDE CODE

> Build Food Signal Coach as an eMed app feature for the eMed x OpenAI Hackathon.
>
> The feature helps people with type 2 diabetes log meals, compare recurring meal patterns with at-home biomarker results, identify transparent possible associations, and try one realistic food alternative. It is a coaching and clinician-communication feature, not a diagnostic or treatment tool.
>
> Start with the backend foundations only:
> - Create FastAPI and Pydantic models for patients, meal logs, glucose readings, weekly checks, context logs, and food signals.
> - Add synthetic JSON data for Aisha, Ben, and Carla.
> - Build a deterministic timeline matcher linking meals to the nearest post-meal reading in a 1–3 hour window.
> - Build a deterministic food-signal engine: group comparable meals, require at least 3 observations, compare against each patient’s baseline, and return evidence, confidence, confounders, and neutral wording.
> - `GET /patients/P001/food-signals` should return Aisha’s explainable cereal-breakfast signal.
> - `GET /patients/P002/food-signals` should return no reliable signal.
> - Do not use an LLM to detect patterns. Do not make medical diagnoses, medication recommendations, or causal claims.
>
> Keep code modular: timeline matching, signal detection, AI coaching, safety rules, clinician summary, and audit log must be separate services.

---

## SUCCESS CRITERIA

- [ ] A patient can log a meal in under 20 seconds.
- [ ] The app detects Aisha’s recurring breakfast association using deterministic rules.
- [ ] The app visibly explains evidence, baseline, sample count, and limitations.
- [ ] The AI asks only useful follow-ups and provides one achievable, personalised alternative.
- [ ] The UI has a safe insufficient-data state and does not invent advice for Ben.
- [ ] A clinician can review a concise, evidence-backed summary without reviewing raw meal logs.
- [ ] Every signal is recorded in an audit trail.
- [ ] The build feels like an eMed feature: supportive, practical, explainable, and designed for life at home.

---

## GO BUILD

Do not build a generic health dashboard. Build one memorable loop: **a patient logs everyday meals, sees an understandable pattern in their own at-home data, and gets one realistic next experiment.**

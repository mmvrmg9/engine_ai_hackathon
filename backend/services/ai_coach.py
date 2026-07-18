"""LLM-backed conversation layer (Phase 3).

The deterministic pattern engine (services/pattern_engine.py) has
already decided *whether* a pattern exists and produced its evidence
and message text. The LLM here only (a) phrases up to two follow-up
questions grounded in that evidence, and (b) polishes the plain-language
explanation and safe next-step wording -- always inside the same
association-only guardrails, and always with a deterministic fallback
so the app keeps working with no API key configured (import errors,
auth errors, and any other failure all fall back the same way).
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from models import (
    EscalationLevel,
    FollowUpQuestion,
    JourneyStage,
    Patient,
    PatternSignal,
    PatternType,
)
from services.language_guard import is_safe

MODEL = os.environ.get("ENDO_LOOP_LLM_MODEL", "claude-opus-4-8")
MAX_FOLLOW_UP_QUESTIONS = 2

SYSTEM_PROMPT = """You are a clinical-documentation assistant embedded in Endo Loop, an at-home pattern-tracking tool for endometriosis and chronic pelvic pain.

A separate deterministic rules engine has ALREADY decided which pattern(s) exist and their exact evidence. You never introduce a new pattern, a causal claim, a diagnosis, a staging claim, or a medication instruction.

Hard constraints:
- Never say "you have", "this is", "this means", or name a specific condition (endometriosis, central sensitization, etc.) as fact.
- Use only association language: "may be associated with", "worth discussing", "worth mentioning to your care team".
- Never suggest a medication, a dose, or a medication change.
- Describe HRV only as "a personal trend signal" -- explicitly never a stand-alone marker of pain severity.
- Concerning symptoms route to "contact your care team", never to an in-app risk score.
- Patient-facing, plain language, roughly 8th-grade reading level, concise.
- Output ONLY the requested JSON. No preamble, no markdown fences."""

_FALLBACK_QUESTIONS: dict[PatternType, list[str]] = {
    PatternType.ESCALATING_PAIN: [
        "Is this pain similar to your usual period pain, or does it feel different?",
        "Has anything else changed recently -- stress, activity, sleep -- around the same time?",
    ],
    PatternType.HRV_AUTONOMIC_COSIGNAL: [
        "Besides the pain, has your sleep or stress level changed over the last few days?",
    ],
    PatternType.POST_SURGICAL_PLATEAU: [
        "Is the pain in the same place as your surgical site, or has it moved?",
        "Have you noticed any fever, unusual discharge, or swelling?",
    ],
}

_NEXT_STEP_TEMPLATES: dict[JourneyStage, str] = {
    JourneyStage.EXPLORING: (
        "Keep logging pain, cycle, sleep, and any GI or bleeding changes daily. "
        "Bring this evidence to your first appointment as a starting point for the conversation."
    ),
    JourneyStage.SUSPECTED_UNDIAGNOSED: (
        "Keep logging pain, cycle, sleep, and any GI or bleeding changes daily. "
        "This history will help your clinician evaluate what's happening."
    ),
    JourneyStage.DIAGNOSED_MANAGING: (
        "Prioritize rest and pacing over the next few days, keep your usual medication "
        "routine as prescribed by your care team, and mention this flare pattern at your next visit."
    ),
    JourneyStage.POST_SURGICAL: (
        "Continue any activity guidance from your surgical team, keep logging daily, "
        "and mention this pattern at your next follow-up."
    ),
}


def _call_llm(user_prompt: str) -> Optional[str]:
    """Best-effort LLM call. Any failure (no package, no credentials, network,
    rate limit, refusal, ...) returns None so the caller falls back."""
    try:
        import anthropic
    except ImportError:
        return None

    try:
        client = anthropic.Anthropic()
        response = client.messages.create(
            model=MODEL,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            output_config={"effort": "low"},
            messages=[{"role": "user", "content": user_prompt}],
        )
    except Exception:
        return None

    if response.stop_reason == "refusal":
        return None
    for block in response.content:
        if block.type == "text":
            return block.text
    return None


def _build_questions(
    pairs: list[tuple[PatternSignal, str]], patient_id: str
) -> list[FollowUpQuestion]:
    return [
        FollowUpQuestion(
            id=str(uuid.uuid4()),
            pattern_id=pattern.id,
            patient_id=patient_id,
            pattern_type=pattern.pattern_type,
            question_text=text,
            created_at=datetime.now(timezone.utc),
        )
        for pattern, text in pairs
    ]


def _follow_up_prompt(patient: Patient, patterns: list[PatternSignal], count: int) -> str:
    evidence_summary = "\n".join(f"- {p.pattern_type.value}: {p.message}" for p in patterns)
    return (
        f"Patient journey stage: {patient.journey_stage.value}.\n"
        f"Detected pattern(s) and their neutral, association-only summaries:\n{evidence_summary}\n\n"
        f"Write exactly {count} short follow-up question(s) a patient could answer in one line, "
        f"grounded only in the evidence above. Return ONLY a JSON array of {count} string(s)."
    )


def generate_follow_up_questions(
    patient: Patient, patterns: list[PatternSignal]
) -> list[FollowUpQuestion]:
    """Never more than MAX_FOLLOW_UP_QUESTIONS, and never asked when there's
    no real pattern to ground them in. The LLM may only re-word the fixed
    set of fallback questions -- it can't add, remove, or change their
    provenance -- so a bad/unsafe LLM response always degrades safely."""
    real_patterns = [p for p in patterns if p.pattern_type != PatternType.INSUFFICIENT_DATA]
    if not real_patterns:
        return []

    candidates: list[tuple[PatternSignal, str]] = []
    for pattern in real_patterns:
        for text in _FALLBACK_QUESTIONS.get(pattern.pattern_type, []):
            candidates.append((pattern, text))
    candidates = candidates[:MAX_FOLLOW_UP_QUESTIONS]
    questions = _build_questions(candidates, patient.id)
    if not questions:
        return questions

    llm_text = _call_llm(_follow_up_prompt(patient, real_patterns, len(questions)))
    if llm_text is None:
        return questions

    try:
        texts = [str(t).strip() for t in json.loads(llm_text)]
    except (json.JSONDecodeError, TypeError, ValueError):
        return questions

    if len(texts) != len(questions) or any(
        not t or len(t) > 240 or not is_safe(t) for t in texts
    ):
        return questions

    for question, text in zip(questions, texts):
        question.question_text = text
    return questions


def _fallback_next_step(
    patient: Patient, escalation: EscalationLevel, reason: Optional[str]
) -> str:
    if escalation == EscalationLevel.CONTACT_CARE_TEAM:
        return f"Contact your care team promptly. {reason}" if reason else "Contact your care team promptly."
    return _NEXT_STEP_TEMPLATES[patient.journey_stage]


def _explanation_prompt(patient: Patient, patterns: list[PatternSignal], next_step: str) -> str:
    evidence_summary = "\n".join(f"- {p.pattern_type.value}: {p.message}" for p in patterns)
    return (
        f"Patient journey stage: {patient.journey_stage.value}.\n"
        f"Detected pattern(s):\n{evidence_summary}\n\n"
        f"Write a short plain-language explanation (2-3 sentences) tying these patterns "
        f"together for the patient, and a short safe next step. The safe next step must stay "
        f"behavioral/self-care (sleep, pacing, logging, contacting care team) -- never medication "
        f"dosing advice. Use this as your safe next step unless a clearly better behavioral "
        f"phrasing of the same idea occurs to you: \"{next_step}\"\n"
        f'Return ONLY JSON: {{"explanation": "...", "next_step": "..."}}'
    )


def generate_explanation_and_next_step(
    patient: Patient,
    patterns: list[PatternSignal],
    escalation: EscalationLevel,
    escalation_reason: Optional[str],
) -> tuple[str, str]:
    real_patterns = [p for p in patterns if p.pattern_type != PatternType.INSUFFICIENT_DATA]
    fallback_explanation = (
        " ".join(p.message for p in real_patterns)
        if real_patterns
        else (patterns[0].message if patterns else "Keep logging to build your pattern history.")
    )
    fallback_next_step = _fallback_next_step(patient, escalation, escalation_reason)

    # Safety-critical escalations, or nothing to polish: skip the LLM entirely.
    if escalation == EscalationLevel.CONTACT_CARE_TEAM or not real_patterns:
        return fallback_explanation, fallback_next_step

    llm_text = _call_llm(_explanation_prompt(patient, real_patterns, fallback_next_step))
    if llm_text is None:
        return fallback_explanation, fallback_next_step

    try:
        parsed = json.loads(llm_text)
        explanation = str(parsed["explanation"]).strip()
        next_step = str(parsed["next_step"]).strip()
    except (json.JSONDecodeError, KeyError, TypeError):
        return fallback_explanation, fallback_next_step

    if not explanation or not next_step or not is_safe(explanation) or not is_safe(next_step):
        return fallback_explanation, fallback_next_step

    return explanation, next_step

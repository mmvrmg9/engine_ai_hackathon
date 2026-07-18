"""Demo-safe structured extraction boundary for conversational voice check-ins.

This is a regex/keyword parser, not an LLM -- consistent with the rest of the
app, no free-text interpretation is allowed to invent clinical meaning. A
production build could replace this with an LLM constrained to the
VoiceCheckInResult schema; pattern detection itself must stay in
services/pattern_engine.py regardless of how the log was captured.

This endpoint never decides a pattern or an escalation -- it only ever
produces a draft DailyLog for the patient to review. Once saved via the
existing POST /patients/{id}/logs, the normal pattern_engine / safety_rules
pipeline runs over it exactly as it would over a manually-typed log.
"""

from __future__ import annotations

import re
from datetime import date as date_
from typing import Optional

from models import DailyLog, FatigueLevel, VoiceCheckInResult

_LOCATIONS = {
    "lower left": "lower_left_pelvic",
    "left pelvic": "lower_left_pelvic",
    "low on my left": "lower_left_pelvic",
    "left side": "lower_left_pelvic",
    "lower right": "lower_right_pelvic",
    "right pelvic": "lower_right_pelvic",
    "low on my right": "lower_right_pelvic",
    "right side": "lower_right_pelvic",
    "central": "central_pelvic",
    "pelvic": "central_pelvic",
    "surgical site": "surgical_site",
    "incision": "surgical_site",
    "back": "lower_back",
}
_TYPES = ("cramping", "sharp", "aching", "burning", "pressure", "stabbing", "dull")
_FRIENDLY_LOCATIONS = {
    "lower_left_pelvic": "low on your left side",
    "lower_right_pelvic": "low on your right side",
    "central_pelvic": "your lower tummy / pelvis",
    "lower_back": "your lower back",
    "surgical_site": "your surgical site",
}


def _match_number(pattern: str, message: str, maximum: int) -> Optional[int]:
    result = re.search(pattern, message, re.I)
    if not result:
        return None
    value = int(result.group(1))
    return value if 0 <= value <= maximum else None


def extract(transcript: str, when: date_) -> VoiceCheckInResult:
    message = transcript.lower()

    pain = _match_number(
        r"(?:pain(?:\s+\w+){0,3}\s+(?:is|was|at)\s+|(?:a|an)\s+)(\d{1,2})\s*(?:/\s*10|out of 10)",
        message,
        10,
    )
    sleep_match = re.search(r"(\d{1,2}(?:\.\d+)?)\s*hours?(?:\s+of)?(?:\s+sleep)?", message, re.I)
    sleep = float(sleep_match.group(1)) if sleep_match and float(sleep_match.group(1)) <= 24 else None
    location = next((value for phrase, value in _LOCATIONS.items() if phrase in message), None)
    pain_type = next((kind for kind in _TYPES if kind in message), None)
    fatigue = (
        FatigueLevel.HIGH
        if any(word in message for word in ("exhausted", "drained", "very tired"))
        else FatigueLevel.MEDIUM
        if "tired" in message
        else FatigueLevel.LOW
    )
    bleeding = any(phrase in message for phrase in ("bleeding", "period started", "on my period"))
    fever = any(word in message for word in ("fever", "temperature", "chills"))
    gi_symptoms = [
        item for item in ("bloating", "nausea", "constipation", "diarrhoea", "diarrhea") if item in message
    ]
    gi_known = bool(gi_symptoms) or any(
        phrase in message
        for phrase in ("no tummy", "no stomach", "no bowel", "no gi", "no digestive", "nothing else")
    )
    medication_taken = any(
        phrase in message for phrase in ("took my medication", "medication taken", "took pain relief")
    )

    log = DailyLog(
        date=when,
        pain_score=pain if pain is not None else 0,
        pain_location=location,
        pain_type=pain_type,
        bleeding=bleeding,
        fever=fever,
        gi_symptoms=gi_symptoms,
        fatigue=fatigue,
        sleep_hours=sleep,
        medication_taken=medication_taken,
    )

    missing = []
    if pain is None:
        missing.append("a pain score from 0 to 10")
    if location is None:
        missing.append("where you feel the pain")
    if pain_type is None:
        missing.append("what the pain feels like")
    if sleep is None:
        missing.append("how much you slept")
    if not gi_known:
        missing.append("whether you have noticed any tummy or bowel symptoms")

    questions: list[str] = []
    if pain is None:
        questions.append("If it feels manageable, what number would you give the pain from 0 to 10?")
    elif location is None:
        questions.append("Where are you feeling the pain most today?")
    elif pain_type is None:
        questions.append("Does the pain feel cramping, sharp, aching, burning, or something else?")
    if sleep is None and len(questions) < 2:
        questions.append("Roughly how many hours did you sleep last night?")
    if not gi_known and len(questions) < 2:
        questions.append(
            "Have you noticed any tummy or bowel symptoms today -- for example bloating, nausea, "
            "constipation or diarrhoea? It's completely fine if not."
        )

    summary_parts = [f"Pain recorded as {log.pain_score}/10" if pain is not None else "Pain score not yet recorded"]
    if location is not None:
        summary_parts.append(f"mostly {_FRIENDLY_LOCATIONS[location]}")
    if pain_type is not None:
        summary_parts.append(f"it feels {pain_type}")
    if sleep is not None:
        summary_parts.append(f"sleep: {sleep:g} hours")

    safety_note = (
        "You mentioned fever, chills, or a temperature -- please follow your care plan and contact "
        "your care team if you are concerned."
        if fever
        else None
    )

    return VoiceCheckInResult(
        extracted_log=log,
        missing_details=missing,
        follow_up_questions=questions[:2],
        neutral_summary="; ".join(summary_parts) + ".",
        safety_note=safety_note,
    )

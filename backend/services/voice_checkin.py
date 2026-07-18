"""Demo-safe structured extraction boundary for conversational check-ins.

Production may replace this parser with an LLM constrained to the VoiceCheckInResult
schema. Pattern decisions remain in deterministic local rules.
"""
import re
from datetime import date
from backend.models import DailyLog, VoiceCheckInResult

LOCATIONS = {
    "lower left": "lower_left_pelvic", "left pelvic": "lower_left_pelvic",
    "lower right": "lower_right_pelvic", "right pelvic": "lower_right_pelvic",
    "pelvic": "pelvic", "back": "lower_back", "abdomen": "abdomen",
}
TYPES = ("cramping", "sharp", "aching", "burning", "stabbing", "dull")

def _match_number(pattern: str, message: str, maximum: int) -> int | None:
    result = re.search(pattern, message, re.I)
    if not result:
        return None
    value = int(result.group(1))
    return value if 0 <= value <= maximum else None

def extract(transcript: str, when: date) -> VoiceCheckInResult:
    message = transcript.lower()
    pain = _match_number(r"(?:pain(?:\s+\w+){0,3}\s+(?:is|was|at)\s+|(?:a|an)\s+)(\d{1,2})\s*(?:/\s*10|out of 10)", message, 10)
    sleep_match = re.search(r"(?:slept\s+)?(\d{1,2}(?:\.\d+)?)\s*hours?(?:\s+of)?(?:\s+sleep)?", message, re.I)
    sleep = float(sleep_match.group(1)) if sleep_match and float(sleep_match.group(1)) <= 24 else 0
    location = next((value for phrase, value in LOCATIONS.items() if phrase in message), "unspecified")
    pain_type = next((kind for kind in TYPES if kind in message), "unspecified")
    fatigue = "high" if any(word in message for word in ("exhausted", "drained", "very tired")) else "medium" if "tired" in message else "low"
    bleeding = any(word in message for word in ("bleeding", "period started", "on my period"))
    fever = any(word in message for word in ("fever", "temperature", "chills"))
    gi = [item for item in ("bloating", "nausea", "constipation", "diarrhoea") if item in message]
    log = DailyLog(date=when, pain_score=pain if pain is not None else 0, pain_location=location, pain_type=pain_type, bleeding=bleeding, gi_symptoms=gi, fatigue=fatigue, sleep_hours=sleep, medication_taken=any(x in message for x in ("took my medication", "medication taken", "took pain relief")), fever=fever)
    missing = []
    if pain is None: missing.append("a pain score from 0 to 10")
    if location == "unspecified": missing.append("where you feel the pain")
    if pain_type == "unspecified": missing.append("what the pain feels like")
    if sleep == 0: missing.append("how much you slept")
    questions = []
    if pain is None: questions.append("If it feels manageable, what number would you give the pain from 0 to 10?")
    elif location == "unspecified": questions.append("Where are you feeling the pain most today?")
    elif pain_type == "unspecified": questions.append("Does the pain feel cramping, sharp, aching, burning, or something else?")
    if sleep == 0 and len(questions) < 2: questions.append("Roughly how many hours did you sleep last night?")
    summary_parts = [f"Pain recorded as {log.pain_score}/10" if pain is not None else "Pain score not yet recorded"]
    if location != "unspecified": summary_parts.append(f"location: {location.replace('_', ' ')}")
    if pain_type != "unspecified": summary_parts.append(f"type: {pain_type}")
    if sleep: summary_parts.append(f"sleep: {sleep:g} hours")
    safety = "You mentioned fever, chills, or a temperature. Please follow your post-operative or clinical care plan and contact your clinical team if you are concerned." if fever else None
    return VoiceCheckInResult(extracted_log=log, missing_details=missing, follow_up_questions=questions[:2], neutral_summary="; ".join(summary_parts) + ".", safety_note=safety)

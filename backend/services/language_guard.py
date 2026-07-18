"""Shared safety-language check.

Any text that will be shown to a patient -- whether it came from a
deterministic template in pattern_engine.py or from the LLM in
ai_coach.py -- must pass this check. LLM output that fails is never
shown; the caller falls back to deterministic template text instead.
"""

from __future__ import annotations

BANNED_PHRASES = [
    "caused by",
    "this means you have",
    "you have endometriosis",
    "this is endometriosis",
    "central sensitization",
    "central sensitisation",
    "diagnos",  # catches diagnosis / diagnose / diagnostic
    "increase your dose",
    "decrease your dose",
    "change your medication",
    "start taking",
    "stop taking",
    "new prescription",
    "milligram",
    " mg ",
]


def is_safe(text: str) -> bool:
    lowered = f" {text.lower()} "
    return not any(phrase in lowered for phrase in BANNED_PHRASES)

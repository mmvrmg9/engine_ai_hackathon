from backend.models import Patient, PatternSignal, JourneyStage

def _evidence(logs):
    return [{"date": str(x.date), "pain_score": x.pain_score, "sleep_hours": x.sleep_hours} for x in logs]

def detect(patient: Patient) -> list[PatternSignal]:
    logs = sorted(patient.daily_logs, key=lambda x: x.date)
    if len(logs) < 2:
        return [PatternSignal(id=f"{patient.id}-insufficient", kind="insufficient_data", title="Keep logging to reveal your pattern", evidence=_evidence(logs), sample_count=len(logs), confidence="not_yet_available", wording="There is not enough comparable information yet. Keep logging so you can review a pattern with your care team.", next_step="Add a few more daily entries, including pain and sleep.")]
    signals = []
    if patient.journey_stage == JourneyStage.post_surgical and len(logs) >= 3 and logs[0].pain_score > logs[1].pain_score and logs[2].pain_score >= logs[1].pain_score:
        signals.append(PatternSignal(id=f"{patient.id}-postop-plateau", kind="post_surgical_plateau", title="Pain has plateaued after an initial decrease", evidence=_evidence(logs[-3:]), sample_count=3, confidence="moderate", wording="Your pain decreased and then stayed the same over the last few entries. After surgery, this is worth discussing with your clinical team, especially if it worsens or comes with fever or heavy bleeding.", next_step="Contact your clinical team if symptoms are worsening or you have fever or heavy bleeding.", escalation=True))
    rising = len(logs) >= 3 and logs[-3].pain_score < logs[-2].pain_score < logs[-1].pain_score
    if rising:
        evidence = _evidence(logs[-3:])
        signals.append(PatternSignal(id=f"{patient.id}-pain-trend", kind="escalating_pain", title="Pain has risen across three entries", evidence=evidence, sample_count=3, confidence="moderate", wording="Your pain score has risen across the last three entries. This trend may be associated with changes in sleep and daily recovery, and is worth discussing with your care team.", next_step="Consider sharing these dated entries with your care team and pace activities around your symptoms."))
        wears = {x.date: x for x in patient.wearable_logs}
        matched = [wears[x.date] for x in logs[-3:] if x.date in wears]
        if len(matched) >= 2 and matched[-1].hrv_ms < matched[0].hrv_ms and all(x.hrv_ms < x.hrv_baseline_ms for x in matched[1:]):
            signals.append(PatternSignal(id=f"{patient.id}-hrv-cosignal", kind="hrv_pain_cosignal", title="Pain and a personal recovery signal moved together", evidence=[{"date":str(x.date),"hrv_ms":x.hrv_ms,"hrv_baseline_ms":x.hrv_baseline_ms} for x in matched], sample_count=len(matched), confidence="moderate", wording=f"Your pain rose while your personal recovery signal moved below its baseline across {len(matched)} entries. This is a trend observation, not a stand-alone measure of pain severity, and may be associated with how you have been feeling.", next_step="Share the pain and wearable trend with your care team; HRV alone does not determine what is happening."))
    return signals or [PatternSignal(id=f"{patient.id}-insufficient", kind="insufficient_data", title="No clear pattern yet", evidence=_evidence(logs), sample_count=len(logs), confidence="not_yet_available", wording="No clear multi-day pattern is visible yet. Keep logging so your own baseline can become more useful.", next_step="Continue daily logging.")]

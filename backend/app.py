import json
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from backend.models import Patient, DailyLog, WearableLog, JourneyStage, VoiceCheckIn
from backend.services.pattern_engine import detect
from backend.services.voice_checkin import extract

DATA = Path(__file__).parent / "data/mock_patients.json"
patients = {p.id: p for p in [Patient.model_validate(x) for x in json.loads(DATA.read_text())["patients"]]}
audit_log = []
app = FastAPI(title="Endo Loop", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

def patient_or_404(pid):
    if pid not in patients: raise HTTPException(404, "Patient not found")
    return patients[pid]

@app.get("/patients")
def list_patients(): return [{"id":p.id,"name":p.name,"journey_stage":p.journey_stage} for p in patients.values()]

@app.get("/patients/{pid}/timeline")
def timeline(pid: str):
    p=patient_or_404(pid); return sorted([{"type":"symptom",**x.model_dump(mode="json")} for x in p.daily_logs]+[{"type":"wearable",**x.model_dump(mode="json")} for x in p.wearable_logs], key=lambda x:x["date"])

@app.get("/patients/{pid}/patterns")
def patterns(pid: str):
    p=patient_or_404(pid); result=detect(p)
    audit_log.extend({"patient_id":pid,"pattern_id":x.id,"sample_count":x.sample_count,"evidence":x.evidence,"wording":x.wording} for x in result)
    return {"patient":p.model_dump(mode="json"),"patterns":[x.model_dump(mode="json") for x in result]}

@app.post("/patients/{pid}/logs")
def add_log(pid: str, log: DailyLog):
    p=patient_or_404(pid); p.daily_logs.append(log); return log

@app.post("/patients/{pid}/voice-check-in")
def voice_check_in(pid: str, check_in: VoiceCheckIn):
    patient_or_404(pid)
    result = extract(check_in.transcript, check_in.date)
    audit_log.append({"patient_id": pid, "event": "voice_check_in_extracted", "transcript": check_in.transcript, "result": result.model_dump(mode="json")})
    return result

@app.post("/patients/{pid}/wearable")
def add_wearable(pid: str, log: WearableLog):
    p=patient_or_404(pid); p.wearable_logs.append(log); return log

@app.patch("/patients/{pid}/journey-stage")
def set_stage(pid: str, stage: JourneyStage):
    p=patient_or_404(pid); p.journey_stage=stage; return {"id":pid,"journey_stage":stage}

@app.get("/audit-log")
def audit(): return audit_log

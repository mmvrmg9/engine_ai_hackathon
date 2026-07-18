// Thin fetch client + types mirroring backend/models.py exactly (field
// names are snake_case on the wire since FastAPI serializes Pydantic
// models directly, no camelCase alias generator).

// In dev, Vite proxies /api -> the local backend (see vite.config.ts) and
// strips the prefix. In production there's no dev-server proxy, so
// VITE_API_BASE must point directly at the deployed backend's origin
// (e.g. https://endo-loop-backend.onrender.com, no trailing slash).
const BASE = import.meta.env.VITE_API_BASE ?? '/api'

export type JourneyStage =
  | 'exploring'
  | 'suspected_undiagnosed'
  | 'diagnosed_managing'
  | 'post_surgical'

export type FatigueLevel = 'low' | 'medium' | 'high'
export type ConfidenceLabel = 'emerging' | 'moderate' | 'notable'
export type PatternType =
  | 'escalating_pain'
  | 'hrv_autonomic_cosignal'
  | 'post_surgical_plateau'
  | 'insufficient_data'
export type EscalationLevel = 'none' | 'watch' | 'contact_care_team'

export interface Preferences {
  goals: string[]
}

export interface DailyLog {
  date: string
  cycle_day: number | null
  pain_score: number
  pain_location: string | null
  pain_type: string | null
  bleeding: boolean
  heavy_bleeding: boolean
  fever: boolean
  gi_symptoms: string[]
  fatigue: FatigueLevel | null
  stress_level: string | null
  sleep_hours: number | null
  medication_taken: boolean
}

export interface WearableLog {
  date: string
  hrv_ms: number
  hrv_baseline_ms: number
  resting_hr: number | null
  skin_temp_delta_c: number | null
  sleep_deep_percent: number | null
  sleep_rem_percent: number | null
  sleep_awakenings: number | null
  respiratory_rate: number | null
  steps: number | null
  eda_us: number | null
}

export interface Patient {
  id: string
  name: string
  journey_stage: JourneyStage
  preferences: Preferences
  surgery_date: string | null
  daily_logs: DailyLog[]
  wearable_logs: WearableLog[]
}

export interface TimelineEntry {
  date: string
  cycle_day: number | null
  pain_score: number | null
  pain_location: string | null
  pain_type: string | null
  bleeding: boolean
  heavy_bleeding: boolean
  fever: boolean
  gi_symptoms: string[]
  fatigue: FatigueLevel | null
  sleep_hours: number | null
  medication_taken: boolean
  hrv_ms: number | null
  hrv_baseline_ms: number | null
  resting_hr: number | null
  skin_temp_delta_c: number | null
}

export interface EvidencePoint {
  date: string
  label: string
  value: string
}

export interface PatternSignal {
  id: string
  patient_id: string
  pattern_type: PatternType
  journey_stage: JourneyStage
  generated_at: string
  rule_version: string
  sample_count: number
  confidence: ConfidenceLabel
  evidence: EvidencePoint[]
  baseline_note: string | null
  message: string
}

export interface FollowUpQuestion {
  id: string
  pattern_id: string
  patient_id: string
  pattern_type: PatternType
  question_text: string
  created_at: string
}

export interface FollowUpAnswer {
  question_id: string
  pattern_id: string
  patient_id: string
  answer_text: string
  answered_at: string
}

export interface PatternsResponse {
  patient_id: string
  journey_stage: JourneyStage
  generated_at: string
  patterns: PatternSignal[]
  escalation: EscalationLevel
  escalation_reason: string | null
  explanation: string | null
  next_step: string | null
  follow_up_questions: FollowUpQuestion[]
}

export interface ClinicianSummaryPatternEntry {
  pattern_type: PatternType
  message: string
  evidence: EvidencePoint[]
  sample_count: number
  confidence: ConfidenceLabel
}

export interface FollowUpQA {
  question_text: string
  answer_text: string | null
}

export interface ClinicianSummary {
  patient_id: string
  patient_name: string
  journey_stage: JourneyStage
  generated_at: string
  headline: string
  patterns: ClinicianSummaryPatternEntry[]
  wearable_observations: WearableLog[]
  follow_up: FollowUpQA[]
  patient_goals: string[]
  escalation: EscalationLevel
  escalation_reason: string | null
  insufficient_data: boolean
}

export interface VoiceCheckIn {
  transcript: string
  date: string
}

export interface VoiceCheckInResult {
  extracted_log: DailyLog
  missing_details: string[]
  follow_up_questions: string[]
  neutral_summary: string
  safety_note: string | null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${init?.method ?? 'GET'} ${path} -> ${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  listPatients: () => request<Patient[]>('/patients'),
  getTimeline: (patientId: string) => request<TimelineEntry[]>(`/patients/${patientId}/timeline`),
  getPatterns: (patientId: string) => request<PatternsResponse>(`/patients/${patientId}/patterns`),
  addDailyLog: (patientId: string, log: Partial<DailyLog> & { date: string; pain_score: number }) =>
    request<DailyLog>(`/patients/${patientId}/logs`, {
      method: 'POST',
      body: JSON.stringify(log),
    }),
  answerFollowUp: (patternId: string, questionId: string, answerText: string) =>
    request<FollowUpAnswer>(`/patterns/${patternId}/follow-up`, {
      method: 'POST',
      body: JSON.stringify({ question_id: questionId, answer_text: answerText }),
    }),
  getClinicianSummary: (patientId: string) =>
    request<ClinicianSummary>(`/patients/${patientId}/clinician-summary`),
  updateJourneyStage: (patientId: string, stage: JourneyStage) =>
    request<Patient>(`/patients/${patientId}/journey-stage`, {
      method: 'PATCH',
      body: JSON.stringify({ journey_stage: stage }),
    }),
  voiceCheckIn: (patientId: string, checkIn: VoiceCheckIn) =>
    request<VoiceCheckInResult>(`/patients/${patientId}/voice-check-in`, {
      method: 'POST',
      body: JSON.stringify(checkIn),
    }),
}

import type { ConfidenceLabel, JourneyStage, PatternType } from '../api'

export const JOURNEY_STAGE_LABELS: Record<JourneyStage, string> = {
  exploring: 'Exploring symptoms',
  suspected_undiagnosed: 'Seeking answers',
  diagnosed_managing: 'Managing endometriosis',
  post_surgical: 'Post-surgical recovery',
}

export const JOURNEY_STAGE_DESCRIPTIONS: Record<JourneyStage, string> = {
  exploring: 'I am tracking symptoms to understand what is happening.',
  suspected_undiagnosed: 'I am building a clearer history for an ongoing diagnostic conversation.',
  diagnosed_managing: 'I am managing a diagnosis and keeping track of changes over time.',
  post_surgical: 'I am monitoring my recovery after surgery.',
}

export const PATTERN_TYPE_LABELS: Record<PatternType, string> = {
  escalating_pain: 'Rising pain pattern',
  hrv_autonomic_cosignal: 'Recovery signal alongside symptoms',
  post_surgical_plateau: 'Recovery pattern worth reviewing',
  insufficient_data: 'Still learning your baseline',
}

export const CONFIDENCE_LABELS: Record<ConfidenceLabel, string> = {
  emerging: 'Early pattern',
  moderate: 'Repeated pattern',
  notable: 'Notable pattern',
}

export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`)
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date)
}

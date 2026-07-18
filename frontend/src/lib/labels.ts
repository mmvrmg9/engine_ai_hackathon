import type { ConfidenceLabel, JourneyStage, PatternType } from '../api'

export const JOURNEY_STAGE_LABELS: Record<JourneyStage, string> = {
  exploring: 'Exploring symptoms',
  suspected_undiagnosed: 'Suspected / undiagnosed',
  diagnosed_managing: 'Diagnosed and managing',
  post_surgical: 'Post-surgical recovery',
}

export const JOURNEY_STAGE_DESCRIPTIONS: Record<JourneyStage, string> = {
  exploring: 'Build evidence for a first clinical conversation.',
  suspected_undiagnosed: 'Document what changes while keeping language cautious.',
  diagnosed_managing: 'Learn your own patterns and prepare for review.',
  post_surgical: 'Watch recovery trends and safety symptoms.',
}

export const PATTERN_TYPE_LABELS: Record<PatternType, string> = {
  escalating_pain: 'Pain trend',
  hrv_autonomic_cosignal: 'Pain and recovery signal',
  post_surgical_plateau: 'Post-surgical recovery trend',
  insufficient_data: 'Keep logging',
}

export const CONFIDENCE_LABELS: Record<ConfidenceLabel, string> = {
  emerging: 'Emerging pattern',
  moderate: 'Moderate evidence',
  notable: 'Notable pattern',
}

export function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10)
}

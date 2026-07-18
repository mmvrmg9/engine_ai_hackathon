import { useState } from 'react'
import type { PatternSignal } from '../api'
import { CONFIDENCE_LABELS, PATTERN_TYPE_LABELS } from '../lib/labels'
import { EvidenceDrawer } from './EvidenceDrawer'

const CONFIDENCE_STYLES: Record<PatternSignal['confidence'], string> = {
  emerging: 'bg-slate-100 text-slate-600',
  moderate: 'bg-amber-100 text-amber-700',
  notable: 'bg-violet-100 text-violet-700',
}

type Feedback = 'accepted' | 'dismissed' | 'not_typical'

const FEEDBACK_COPY: Record<Feedback, string> = {
  accepted: 'Thanks -- marked as helpful for this session.',
  dismissed: "Thanks -- we'll treat this one as noise.",
  not_typical: "Noted as not typical for you -- worth mentioning to your care team.",
}

export function PatternCard({ pattern }: { pattern: PatternSignal }) {
  const [showEvidence, setShowEvidence] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{PATTERN_TYPE_LABELS[pattern.pattern_type]}</h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CONFIDENCE_STYLES[pattern.confidence]}`}
        >
          {CONFIDENCE_LABELS[pattern.confidence]}
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-slate-700">{pattern.message}</p>

      <button
        type="button"
        onClick={() => setShowEvidence((v) => !v)}
        className="mt-3 text-sm font-medium text-violet-700 underline-offset-2 hover:underline"
      >
        {showEvidence ? 'Hide the evidence' : 'Why am I seeing this?'}
      </button>

      {showEvidence && (
        <EvidenceDrawer
          evidence={pattern.evidence}
          baselineNote={pattern.baseline_note}
          sampleCount={pattern.sample_count}
          ruleVersion={pattern.rule_version}
        />
      )}

      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="mb-2 text-xs font-medium text-slate-500">Does this match what you're noticing?</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFeedback('accepted')}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
              feedback === 'accepted'
                ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                : 'border-slate-300 text-slate-600 hover:border-emerald-400'
            }`}
          >
            Yes, that's right
          </button>
          <button
            type="button"
            onClick={() => setFeedback('not_typical')}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
              feedback === 'not_typical'
                ? 'border-amber-600 bg-amber-50 text-amber-700'
                : 'border-slate-300 text-slate-600 hover:border-amber-400'
            }`}
          >
            Not typical for me
          </button>
          <button
            type="button"
            onClick={() => setFeedback('dismissed')}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
              feedback === 'dismissed'
                ? 'border-slate-500 bg-slate-100 text-slate-700'
                : 'border-slate-300 text-slate-600 hover:border-slate-400'
            }`}
          >
            Dismiss
          </button>
        </div>
        {feedback && <p className="mt-2 text-xs text-slate-500">{FEEDBACK_COPY[feedback]}</p>}
      </div>
    </div>
  )
}

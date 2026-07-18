import { useState } from 'react'
import type { JourneyStage } from '../api'
import { usePatientContext } from '../context/PatientContext'
import { JOURNEY_STAGE_DESCRIPTIONS, JOURNEY_STAGE_LABELS } from '../lib/labels'

const STAGES: JourneyStage[] = [
  'exploring',
  'suspected_undiagnosed',
  'diagnosed_managing',
  'post_surgical',
]

export function JourneyStagePage() {
  const { selected, setJourneyStage } = usePatientContext()
  const [saving, setSaving] = useState<JourneyStage | null>(null)

  if (!selected) return null

  const handleSelect = async (stage: JourneyStage) => {
    if (stage === selected.journey_stage) return
    setSaving(stage)
    try {
      await setJourneyStage(stage)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Where are you in your journey?</h1>
        <p className="mt-1 text-sm text-slate-500">
          This is your own context, not a diagnosis -- change it any time as your situation
          changes. It shapes the language and safety flags Endo Loop uses, nothing else.
        </p>
      </div>

      <div className="space-y-3">
        {STAGES.map((stage) => {
          const active = stage === selected.journey_stage
          return (
            <button
              key={stage}
              type="button"
              onClick={() => handleSelect(stage)}
              disabled={saving !== null}
              className={`w-full rounded-2xl border p-4 text-left transition-colors disabled:opacity-60 ${
                active
                  ? 'border-violet-600 bg-violet-50'
                  : 'border-slate-200 bg-white hover:border-violet-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-semibold ${active ? 'text-violet-800' : 'text-slate-900'}`}>
                  {JOURNEY_STAGE_LABELS[stage]}
                </span>
                {active && (
                  <span className="rounded-full bg-violet-600 px-2 py-0.5 text-xs font-medium text-white">
                    Selected
                  </span>
                )}
                {saving === stage && <span className="text-xs text-slate-400">Saving...</span>}
              </div>
              <p className="mt-1 text-sm text-slate-500">{JOURNEY_STAGE_DESCRIPTIONS[stage]}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

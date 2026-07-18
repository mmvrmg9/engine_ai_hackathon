import { useEffect, useState } from 'react'
import { api, type ClinicianRiskReview } from '../api'
import { usePatientContext } from '../context/PatientContext'

const BAND_COPY = {
  monitoring: { label: 'Monitor', classes: 'border-slate-200 bg-slate-100 text-slate-700' },
  review: { label: 'Review', classes: 'border-amber-200 bg-amber-50 text-amber-800' },
  priority_review: { label: 'Priority review', classes: 'border-rose-200 bg-rose-50 text-rose-800' },
}

function ScoreBar({ label, score, detail, colour }: { label: string; score: number; detail: string; colour: string }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <p className="text-xs text-slate-500">{detail}</p>
        </div>
        <p className="text-lg font-bold text-slate-900">{score.toFixed(1)}<span className="text-xs text-slate-400"> / 10</span></p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${colour}`} style={{ width: `${score * 10}%` }} />
      </div>
    </div>
  )
}

export function ClinicianReview() {
  const { selected } = usePatientContext()
  const [review, setReview] = useState<ClinicianRiskReview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    setLoading(true)
    setError(null)
    api.getClinicianRiskReview(selected.id)
      .then((result) => {
        if (!cancelled) setReview(result)
      })
      .catch(() => {
        if (!cancelled) setError('This review is unavailable until the patient has approved clinician access.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selected])

  if (!selected) return null

  const band = review ? BAND_COPY[review.band] : null

  return (
    <div className="space-y-4 bg-slate-100 p-4">
      <div className="rounded-2xl bg-slate-950 p-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">Clinician workspace</p>
        <h1 className="mt-2 text-2xl font-bold">{selected.name}</h1>
        <p className="mt-1 text-sm text-slate-300">Internal review only - not shown in the patient app</p>

        {loading && <p className="mt-6 text-sm text-slate-300">Calculating internal review score...</p>}
        {review && band && (
          <div className="mt-5 rounded-2xl bg-white p-4 text-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Hidden risk score</p>
                <p className="mt-1 text-5xl font-bold tracking-tight">{review.final_score_100}<span className="text-lg text-slate-400"> / 100</span></p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${band.classes}`}>{band.label}</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">{review.formula}</p>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Access not confirmed</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {review && (
        <>
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Score breakdown</h2>
              <span className="text-xs text-slate-400">{review.pain_observations} recent logs</span>
            </div>
            <div className="space-y-5">
              <ScoreBar label="Pain review" score={review.pain_score_10} detail="Recent pain average - 60% of final score" colour="bg-rose-500" />
              <ScoreBar label="Mood signal" score={review.mood.score_10} detail={`Wellbeing language - ${review.mood.source === 'llm' ? 'AI-assisted' : review.mood.source === 'fallback' ? 'fallback' : 'no note available'}`} colour="bg-violet-600" />
            </div>
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Wellbeing-language review</p>
            <p className="mt-2 text-sm font-semibold text-slate-800">{review.mood.label}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{review.mood.note_summary}</p>
            {review.latest_feeling_note && (
              <blockquote className="mt-3 rounded-xl border-l-4 border-violet-400 bg-violet-50 p-3 text-sm italic leading-relaxed text-slate-700">
                “{review.latest_feeling_note}”
              </blockquote>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
            <p className="font-semibold text-slate-700">Clinical guardrail</p>
            <p className="mt-1">{review.clinician_note}</p>
          </section>
        </>
      )}
    </div>
  )
}

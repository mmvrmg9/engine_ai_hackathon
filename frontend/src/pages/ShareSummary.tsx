import { useEffect, useState } from 'react'
import { api, type ClinicianSummary } from '../api'
import { usePatientContext } from '../context/PatientContext'
import { EscalationBanner } from '../components/EscalationBanner'
import { CONFIDENCE_LABELS, JOURNEY_STAGE_LABELS, PATTERN_TYPE_LABELS, formatDate } from '../lib/labels'

function buildPlainText(summary: ClinicianSummary): string {
  const lines: string[] = []
  lines.push(`Endo Loop clinician summary -- ${summary.patient_name}`)
  lines.push(`Journey stage: ${JOURNEY_STAGE_LABELS[summary.journey_stage]}`)
  lines.push(`Generated: ${new Date(summary.generated_at).toLocaleString()}`)
  lines.push('')
  lines.push(summary.headline)
  lines.push('')

  if (summary.escalation !== 'none') {
    lines.push(`SAFETY FLAG: ${summary.escalation_reason ?? summary.escalation}`)
    lines.push('')
  }

  if (summary.insufficient_data) {
    lines.push('Not enough logged data yet to identify a pattern.')
  } else {
    lines.push('Patterns and evidence:')
    for (const p of summary.patterns) {
      lines.push(`- ${PATTERN_TYPE_LABELS[p.pattern_type]} (${CONFIDENCE_LABELS[p.confidence]}, ${p.sample_count} data points)`)
      lines.push(`  ${p.message}`)
    }
  }

  if (summary.follow_up.length > 0) {
    lines.push('')
    lines.push('Patient-reported follow-up:')
    for (const qa of summary.follow_up) {
      lines.push(`- Q: ${qa.question_text}`)
      lines.push(`  A: ${qa.answer_text ?? '(not yet answered)'}`)
    }
  }

  if (summary.patient_goals.length > 0) {
    lines.push('')
    lines.push(`Patient goals: ${summary.patient_goals.join('; ')}`)
  }

  return lines.join('\n')
}

export function ShareSummary() {
  const { selected } = usePatientContext()
  const [summary, setSummary] = useState<ClinicianSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    setLoading(true)
    api.getClinicianSummary(selected.id).then((result) => {
      if (!cancelled) {
        setSummary(result)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [selected])

  if (!selected) return null

  const handleCopy = async () => {
    if (!summary) return
    await navigator.clipboard.writeText(buildPlainText(summary))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Share with my care team</h1>
      </div>

      {loading && <p className="text-sm text-slate-400">Building your summary...</p>}

      {!loading && summary && (
        <>
          <div className="flex gap-2 no-print">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 rounded-xl border border-slate-300 py-2 text-sm font-semibold text-slate-700"
            >
              Print / Save as PDF
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 rounded-xl bg-violet-600 py-2 text-sm font-semibold text-white"
            >
              {copied ? 'Copied' : 'Copy as text'}
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-slate-400">Endo Loop summary</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">{summary.patient_name}</h2>
            <p className="text-sm text-slate-500">
              {JOURNEY_STAGE_LABELS[summary.journey_stage]} &middot; generated{' '}
              {new Date(summary.generated_at).toLocaleDateString()}
            </p>
            <p className="mt-3 text-sm font-medium text-slate-700">{summary.headline}</p>

            {summary.escalation !== 'none' && (
              <div className="mt-4">
                <EscalationBanner level={summary.escalation} reason={summary.escalation_reason} />
              </div>
            )}

            <div className="mt-4 space-y-4">
              {summary.insufficient_data && (
                <p className="text-sm text-slate-500">
                  Not enough logged data yet to identify a pattern. This is a starter summary --
                  bring it to your first appointment as a baseline.
                </p>
              )}

              {summary.patterns.map((p, i) => (
                <div key={i} className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {PATTERN_TYPE_LABELS[p.pattern_type]}
                    </h3>
                    <span className="text-xs text-slate-400">
                      {CONFIDENCE_LABELS[p.confidence]} &middot; {p.sample_count} points
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{p.message}</p>
                  <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                    {p.evidence.map((e, j) => (
                      <li key={j}>
                        {formatDate(e.date)} &mdash; {e.label.replace(/_/g, ' ')}: {e.value}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {summary.follow_up.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Patient-reported follow-up
                </p>
                <div className="space-y-2">
                  {summary.follow_up.map((qa, i) => (
                    <div key={i} className="text-sm">
                      <p className="font-medium text-slate-800">{qa.question_text}</p>
                      <p className="text-slate-500">{qa.answer_text ?? 'Not yet answered'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {summary.patient_goals.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Patient goals
                </p>
                <p className="text-sm text-slate-600">{summary.patient_goals.join('; ')}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

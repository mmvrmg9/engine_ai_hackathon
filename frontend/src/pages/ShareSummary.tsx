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

  if (summary.wearable_observations.length > 0) {
    lines.push('Wearable observations (last 7 recorded days):')
    for (const w of summary.wearable_observations) {
      const metrics = [
        `HRV ${w.hrv_ms} ms (personal baseline ${w.hrv_baseline_ms} ms)`,
        w.resting_hr != null ? `resting HR ${w.resting_hr} bpm` : null,
        w.skin_temp_delta_c != null ? `skin temperature ${w.skin_temp_delta_c >= 0 ? '+' : ''}${w.skin_temp_delta_c} C from baseline` : null,
        w.sleep_deep_percent != null ? `deep sleep ${w.sleep_deep_percent}%` : null,
        w.sleep_rem_percent != null ? `REM sleep ${w.sleep_rem_percent}%` : null,
        w.sleep_awakenings != null ? `awakenings ${w.sleep_awakenings}` : null,
        w.respiratory_rate != null ? `respiratory rate ${w.respiratory_rate}/min` : null,
        w.steps != null ? `steps ${w.steps}` : null,
        w.eda_us != null ? `EDA ${w.eda_us} uS` : null,
      ].filter(Boolean)
      lines.push(`- ${formatDate(w.date)}: ${metrics.join('; ')}`)
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
              className="flex-1 rounded-xl bg-rose-600 py-2 text-sm font-semibold text-white"
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

            {summary.wearable_observations.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Wearable observations
                </p>
                <p className="mb-3 text-xs text-slate-500">
                  Device readings are shown as observations alongside symptoms. Missing device fields are left blank rather than inferred.
                </p>
                <div className="space-y-2">
                  {summary.wearable_observations.map((w) => (
                    <div key={w.date} className="rounded-xl bg-rose-50/60 p-3 text-xs text-slate-600">
                      <p className="mb-1 font-semibold text-slate-800">{formatDate(w.date)}</p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
                        <span>HRV: {w.hrv_ms} ms</span>
                        <span>Usual HRV: {w.hrv_baseline_ms} ms</span>
                        <span>Resting HR: {w.resting_hr != null ? `${w.resting_hr} bpm` : 'Not recorded'}</span>
                        <span>Skin temp: {w.skin_temp_delta_c != null ? `${w.skin_temp_delta_c >= 0 ? '+' : ''}${w.skin_temp_delta_c} C` : 'Not recorded'}</span>
                        <span>Deep sleep: {w.sleep_deep_percent != null ? `${w.sleep_deep_percent}%` : 'Not recorded'}</span>
                        <span>REM sleep: {w.sleep_rem_percent != null ? `${w.sleep_rem_percent}%` : 'Not recorded'}</span>
                        <span>Awakenings: {w.sleep_awakenings ?? 'Not recorded'}</span>
                        <span>Respiratory rate: {w.respiratory_rate != null ? `${w.respiratory_rate}/min` : 'Not recorded'}</span>
                        <span>Steps: {w.steps ?? 'Not recorded'}</span>
                        <span>EDA: {w.eda_us != null ? `${w.eda_us} uS` : 'Not recorded'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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

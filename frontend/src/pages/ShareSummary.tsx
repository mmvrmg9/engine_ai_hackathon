import { useEffect, useState } from 'react'
import { api, type ClinicianSummary, type DataAccessLevel } from '../api'
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

const ACCESS_OPTIONS: Array<{
  value: DataAccessLevel
  label: string
  description: string
}> = [
  {
    value: 'private',
    label: 'Private',
    description: 'Only you can view this information in Endo Loop.',
  },
  {
    value: 'ask_each_time',
    label: 'Ask me each time',
    description: 'Endo Loop asks before each report is shared with your care team.',
  },
  {
    value: 'automated_report',
    label: 'Automated reports',
    description: 'A report is made available to your care team when Endo Loop finds a meaningful pattern or safety flag.',
  },
]

export function ShareSummary() {
  const { selected, setDataAccess } = usePatientContext()
  const [summary, setSummary] = useState<ClinicianSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [savingAccess, setSavingAccess] = useState(false)
  const [showSharePrompt, setShowSharePrompt] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareMessage, setShareMessage] = useState<string | null>(null)

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

  const changeAccess = async (dataAccess: DataAccessLevel) => {
    setSavingAccess(true)
    setShareMessage(null)
    try {
      await setDataAccess(dataAccess)
      setShowSharePrompt(false)
    } finally {
      setSavingAccess(false)
    }
  }

  const sendReport = async (patientConfirmed = false) => {
    if (!selected) return
    setSharing(true)
    try {
      const receipt = await api.shareClinicianSummary(selected.id, patientConfirmed)
      setShareMessage(receipt.delivery)
      setShowSharePrompt(false)
    } catch (error) {
      setShareMessage(error instanceof Error ? 'The report could not be shared.' : 'The report could not be shared.')
    } finally {
      setSharing(false)
    }
  }

  const handleShare = () => {
    setShareMessage(null)
    if (selected.preferences.data_access === 'ask_each_time') {
      setShowSharePrompt(true)
      return
    }
    if (selected.preferences.data_access === 'automated_report') {
      void sendReport()
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Share with my care team</h1>
      </div>

      {loading && <p className="text-sm text-slate-400">Building your summary...</p>}

      {!loading && summary && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Report privacy</p>
            <h2 className="mt-1 text-base font-bold text-slate-900">Choose how your data is shared</h2>
            <p className="mt-1 text-sm text-slate-500">
              You can change this at any time. Pattern insights always remain visible to you.
            </p>
            <div className="mt-3 space-y-2">
              {ACCESS_OPTIONS.map((option) => {
                const isSelected = selected.preferences.data_access === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={savingAccess}
                    onClick={() => void changeAccess(option.value)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors disabled:opacity-50 ${
                      isSelected
                        ? 'border-violet-500 bg-violet-50'
                        : 'border-slate-200 bg-white hover:border-violet-200'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-800">{option.label}</span>
                      <span
                        aria-hidden="true"
                        className={`h-4 w-4 rounded-full border-4 ${
                          isSelected ? 'border-violet-600 bg-white' : 'border-slate-200 bg-white'
                        }`}
                      />
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-500">{option.description}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {showSharePrompt && (
            <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
              <p className="text-sm font-semibold text-violet-900">Share this report with your care team?</p>
              <p className="mt-1 text-sm leading-relaxed text-violet-800">
                This report includes your symptom history, observed patterns, and your follow-up answers.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void sendReport(true)}
                  disabled={sharing}
                  className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {sharing ? 'Sharing...' : 'Yes, share report'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSharePrompt(false)}
                  disabled={sharing}
                  className="rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-800"
                >
                  Not now
                </button>
              </div>
            </section>
          )}

          {shareMessage && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {shareMessage}
            </p>
          )}

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

          {selected.preferences.data_access === 'private' ? (
            <p className="rounded-xl border border-slate-200 bg-slate-100 p-3 text-sm text-slate-600">
              Your setting is Private. This report will not be shared with your care team.
            </p>
          ) : selected.preferences.data_access === 'ask_each_time' ? (
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              className="w-full rounded-xl bg-violet-700 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {sharing ? 'Sharing report...' : 'Share with my care team'}
            </button>
          ) : (
            <p className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">
              Automated reports are enabled. Your care team will receive a report when Endo Loop finds a meaningful pattern or safety flag.
            </p>
          )}

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

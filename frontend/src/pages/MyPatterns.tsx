import { useEffect, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, type PatternsResponse, type TimelineEntry } from '../api'
import { usePatientContext } from '../context/usePatientContext'
import { PatternCard } from '../components/PatternCard'
import { EscalationBanner } from '../components/EscalationBanner'
import { formatDate } from '../lib/labels'

export function MyPatterns() {
  const { selected } = usePatientContext()
  const [patterns, setPatterns] = useState<PatternsResponse | null>(null)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    setLoading(true)
    Promise.all([api.getPatterns(selected.id), api.getTimeline(selected.id)]).then(
      ([patternsResult, timelineResult]) => {
        if (cancelled) return
        setPatterns(patternsResult)
        setTimeline(timelineResult)
        setLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [selected])

  if (!selected) return null

  const chartData = timeline
    .filter((e) => e.pain_score !== null)
    .map((e) => ({ date: formatDate(e.date), pain: e.pain_score }))

  const realPatterns = patterns?.patterns.filter((p) => p.pattern_type !== 'insufficient_data') ?? []
  const insufficientData = patterns?.patterns.some((p) => p.pattern_type === 'insufficient_data')

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold text-slate-900">My Patterns</h1>

      {loading && <p className="text-sm text-slate-400">Loading...</p>}

      {!loading && patterns && (
        <>
          <EscalationBanner level={patterns.escalation} reason={patterns.escalation_reason} />

          {chartData.length > 1 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Pain over time
              </p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} stroke="#94a3b8" width={28} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="pain"
                      stroke="#e11d48"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Pain score"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {realPatterns.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
              <p className="text-sm text-slate-600">
                {insufficientData
                  ? patterns.patterns[0]?.message
                  : "No patterns stand out in your recent logs. That's a good thing -- keep logging so we can spot anything worth flagging."}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {realPatterns.map((pattern) => (
              <PatternCard key={pattern.id} pattern={pattern} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

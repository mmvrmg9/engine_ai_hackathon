import type { EvidencePoint } from '../api'
import { formatDate } from '../lib/labels'

export function EvidenceDrawer({
  evidence,
  baselineNote,
  sampleCount,
  ruleVersion,
}: {
  evidence: EvidencePoint[]
  baselineNote: string | null
  sampleCount: number
  ruleVersion: string
}) {
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Exact evidence ({sampleCount} data point{sampleCount === 1 ? '' : 's'})
      </p>
      {evidence.length === 0 ? (
        <p className="text-slate-500">No individual data points yet -- keep logging.</p>
      ) : (
        <ul className="space-y-1">
          {evidence.map((point, i) => (
            <li key={`${point.date}-${point.label}-${i}`} className="flex justify-between gap-3">
              <span className="text-slate-500">
                {formatDate(point.date)} &middot; {point.label.replace(/_/g, ' ')}
              </span>
              <span className="font-medium text-slate-800">{point.value}</span>
            </li>
          ))}
        </ul>
      )}
      {baselineNote && (
        <p className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-500">{baselineNote}</p>
      )}
      <p className="mt-2 text-[11px] text-slate-400">Rule version: {ruleVersion}</p>
    </div>
  )
}

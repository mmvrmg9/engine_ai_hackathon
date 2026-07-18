import type { EscalationLevel } from '../api'

const STYLES: Record<Exclude<EscalationLevel, 'none'>, string> = {
  watch: 'border-amber-300 bg-amber-50 text-amber-800',
  contact_care_team: 'border-red-300 bg-red-50 text-red-800',
}

const TITLES: Record<Exclude<EscalationLevel, 'none'>, string> = {
  watch: 'Worth watching',
  contact_care_team: 'Contact your care team',
}

export function EscalationBanner({
  level,
  reason,
}: {
  level: EscalationLevel
  reason: string | null
}) {
  if (level === 'none') return null

  return (
    <div className={`rounded-2xl border p-4 ${STYLES[level]}`}>
      <p className="font-semibold">{TITLES[level]}</p>
      {reason && <p className="mt-1 text-sm">{reason}</p>}
    </div>
  )
}

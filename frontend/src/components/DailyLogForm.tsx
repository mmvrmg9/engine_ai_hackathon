import { useState, type FormEvent, type ReactNode } from 'react'
import type { DailyLog, FatigueLevel } from '../api'
import { todayISODate } from '../lib/labels'

const PAIN_LOCATIONS = ['lower_left_pelvic', 'lower_right_pelvic', 'central_pelvic', 'lower_back', 'surgical_site']
const PAIN_TYPES = ['cramping', 'sharp', 'aching', 'burning', 'pressure']
const GI_OPTIONS = ['bloating', 'nausea', 'diarrhea', 'constipation']
const FATIGUE_OPTIONS: FatigueLevel[] = ['low', 'medium', 'high']

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'border-rose-600 bg-rose-600 text-white'
          : 'border-slate-300 bg-white text-slate-600 hover:border-rose-400'
      }`}
    >
      {children}
    </button>
  )
}

function label(value: string): string {
  return value.replace(/_/g, ' ')
}

export function DailyLogForm({
  showCycleDay,
  onSubmit,
  submitting,
}: {
  showCycleDay: boolean
  onSubmit: (log: Partial<DailyLog> & { date: string; pain_score: number }) => Promise<void>
  submitting: boolean
}) {
  const [painScore, setPainScore] = useState(3)
  const [painLocation, setPainLocation] = useState<string | null>(null)
  const [painType, setPainType] = useState<string | null>(null)
  const [bleeding, setBleeding] = useState(false)
  const [heavyBleeding, setHeavyBleeding] = useState(false)
  const [fever, setFever] = useState(false)
  const [medicationTaken, setMedicationTaken] = useState(false)
  const [fatigue, setFatigue] = useState<FatigueLevel>('low')
  const [sleepHours, setSleepHours] = useState(7)
  const [giSymptoms, setGiSymptoms] = useState<string[]>([])
  const [cycleDay, setCycleDay] = useState('')
  const [done, setDone] = useState(false)

  const toggleGi = (symptom: string) => {
    setGiSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom],
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await onSubmit({
      date: todayISODate(),
      pain_score: painScore,
      pain_location: painLocation,
      pain_type: painType,
      bleeding,
      heavy_bleeding: heavyBleeding,
      fever,
      medication_taken: medicationTaken,
      fatigue,
      sleep_hours: sleepHours,
      gi_symptoms: giSymptoms,
      cycle_day: showCycleDay && cycleDay ? Number(cycleDay) : null,
    })
    setDone(true)
    setTimeout(() => setDone(false), 2500)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4">
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <p className="text-sm font-semibold text-slate-700">Pain today</p>
          <span className="text-2xl font-bold text-rose-700">{painScore}</span>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pain score from zero to ten">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPainScore(n)}
              aria-label={`Pain ${n} out of 10`}
              aria-pressed={n === painScore}
              className={`h-9 w-9 shrink-0 rounded-full text-sm font-semibold transition-colors ${
                n <= painScore
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-slate-400">
          <span>No pain</span>
          <span>Worst pain</span>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-semibold text-slate-700">Location</p>
        <div className="flex flex-wrap gap-2">
          {PAIN_LOCATIONS.map((loc) => (
            <Chip key={loc} active={painLocation === loc} onClick={() => setPainLocation(loc === painLocation ? null : loc)}>
              {label(loc)}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-semibold text-slate-700">Type</p>
        <div className="flex flex-wrap gap-2">
          {PAIN_TYPES.map((type) => (
            <Chip key={type} active={painType === type} onClick={() => setPainType(type === painType ? null : type)}>
              {label(type)}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip active={bleeding} onClick={() => setBleeding((v) => !v)}>
          Bleeding
        </Chip>
        <Chip active={heavyBleeding} onClick={() => setHeavyBleeding((v) => !v)}>
          Heavy bleeding
        </Chip>
        <Chip active={fever} onClick={() => setFever((v) => !v)}>
          Fever
        </Chip>
        <Chip active={medicationTaken} onClick={() => setMedicationTaken((v) => !v)}>
          Took medication
        </Chip>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-semibold text-slate-700">GI symptoms</p>
        <div className="flex flex-wrap gap-2">
          {GI_OPTIONS.map((symptom) => (
            <Chip key={symptom} active={giSymptoms.includes(symptom)} onClick={() => toggleGi(symptom)}>
              {label(symptom)}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-semibold text-slate-700">Fatigue</p>
        <div className="flex flex-wrap gap-2">
          {FATIGUE_OPTIONS.map((f) => (
            <Chip key={f} active={fatigue === f} onClick={() => setFatigue(f)}>
              {label(f)}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-semibold text-slate-700">Sleep last night</p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setSleepHours((h) => Math.max(0, h - 0.5))}
            aria-label="Reduce sleep hours"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-xl font-bold text-rose-700 hover:bg-rose-100"
          >
            &minus;
          </button>
          <span className="min-w-[4rem] text-center text-xl font-bold text-rose-700">
            {sleepHours % 1 === 0 ? sleepHours : sleepHours.toFixed(1)}h
          </span>
          <button
            type="button"
            onClick={() => setSleepHours((h) => Math.min(24, h + 0.5))}
            aria-label="Increase sleep hours"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-xl font-bold text-rose-700 hover:bg-rose-100"
          >
            +
          </button>
        </div>
      </div>

      {showCycleDay && (
        <div>
          <label htmlFor="cycle-day" className="mb-1.5 block text-sm font-semibold text-slate-700">
            Cycle day (optional)
          </label>
          <input
            id="cycle-day"
            type="number"
            min={1}
            max={45}
            value={cycleDay}
            onChange={(e) => setCycleDay(e.target.value)}
            placeholder="e.g. 14"
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-rose-500 focus:outline-none"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
      >
        {submitting ? 'Saving...' : done ? 'Logged for today' : 'Log today'}
      </button>
    </form>
  )
}

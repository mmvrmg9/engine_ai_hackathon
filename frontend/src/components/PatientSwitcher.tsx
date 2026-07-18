import { usePatientContext } from '../context/usePatientContext'
import { JOURNEY_STAGE_LABELS } from '../lib/labels'

export function PatientSwitcher() {
  const { patients, selectedId, selectPatient, selected } = usePatientContext()

  if (patients.length === 0) return null

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-sm font-semibold text-rose-700">
        {selected?.name.slice(0, 1) ?? '?'}
      </div>
      <div className="min-w-0 flex-1">
        <select
          value={selectedId}
          onChange={(e) => selectPatient(e.target.value)}
          className="w-full truncate bg-transparent text-base font-semibold text-slate-900 focus:outline-none"
          aria-label="Switch demo patient"
        >
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {selected && (
          <p className="truncate text-xs text-slate-500">
            {JOURNEY_STAGE_LABELS[selected.journey_stage]}
          </p>
        )}
      </div>
    </div>
  )
}

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, type JourneyStage, type Patient } from '../api'

interface PatientContextValue {
  patients: Patient[]
  selectedId: string
  selected: Patient | null
  loading: boolean
  error: string | null
  selectPatient: (id: string) => void
  setJourneyStage: (stage: JourneyStage) => Promise<void>
  refreshPatients: () => Promise<void>
}

const PatientContext = createContext<PatientContextValue | null>(null)

const LAST_PATIENT_KEY = 'endo-loop:selected-patient'

export function PatientProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedId, setSelectedId] = useState<string>(
    () => localStorage.getItem(LAST_PATIENT_KEY) ?? '',
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshPatients = async () => {
    try {
      setError(null)
      const list = await api.listPatients()
      setPatients(list)
      setSelectedId((current) => {
        if (current && list.some((p) => p.id === current)) return current
        return list[0]?.id ?? ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the Endo Loop API.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshPatients()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedId) localStorage.setItem(LAST_PATIENT_KEY, selectedId)
  }, [selectedId])

  const selected = patients.find((p) => p.id === selectedId) ?? null

  const setJourneyStage = async (stage: JourneyStage) => {
    if (!selected) return
    const updated = await api.updateJourneyStage(selected.id, stage)
    setPatients((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  return (
    <PatientContext.Provider
      value={{
        patients,
        selectedId,
        selected,
        loading,
        error,
        selectPatient: setSelectedId,
        setJourneyStage,
        refreshPatients,
      }}
    >
      {children}
    </PatientContext.Provider>
  )
}

export function usePatientContext() {
  const ctx = useContext(PatientContext)
  if (!ctx) throw new Error('usePatientContext must be used within a PatientProvider')
  return ctx
}

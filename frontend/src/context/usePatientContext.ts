import { createContext, useContext } from 'react'
import type { DataAccessLevel, JourneyStage, Patient } from '../api'

export interface PatientContextValue {
  patients: Patient[]
  selectedId: string
  selected: Patient | null
  loading: boolean
  error: string | null
  selectPatient: (id: string) => void
  setJourneyStage: (stage: JourneyStage) => Promise<void>
  setDataAccess: (dataAccess: DataAccessLevel) => Promise<void>
  refreshPatients: () => Promise<void>
}

export const PatientContext = createContext<PatientContextValue | null>(null)

export function usePatientContext() {
  const ctx = useContext(PatientContext)
  if (!ctx) throw new Error('usePatientContext must be used within a PatientProvider')
  return ctx
}

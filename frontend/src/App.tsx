import { Route, Routes } from 'react-router-dom'
import { PatientProvider } from './context/PatientContext'
import { usePatientContext } from './context/usePatientContext'
import { PatientSwitcher } from './components/PatientSwitcher'
import { BottomNav } from './components/BottomNav'
import { Today } from './pages/Today'
import { MyPatterns } from './pages/MyPatterns'
import { ShareSummary } from './pages/ShareSummary'
import { JourneyStagePage } from './pages/JourneyStage'

function AppShell() {
  const { loading, error, patients } = usePatientContext()

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white no-print">
        <PatientSwitcher />
      </header>

      <main className="flex-1 pb-24">
        {loading && <div className="p-6 text-center text-slate-400">Loading Endo Loop...</div>}

        {!loading && error && (
          <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-semibold">Can't reach the Endo Loop API.</p>
            <p className="mt-1">{error}</p>
            <p className="mt-2 text-red-500">
              Make sure the backend is running: <code>cd backend &amp;&amp; python -m uvicorn app:app --reload</code>
            </p>
          </div>
        )}

        {!loading && !error && patients.length === 0 && (
          <div className="m-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            No patients found.
          </div>
        )}

        {!loading && !error && patients.length > 0 && (
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/patterns" element={<MyPatterns />} />
            <Route path="/share" element={<ShareSummary />} />
            <Route path="/journey" element={<JourneyStagePage />} />
          </Routes>
        )}
      </main>

      <div className="no-print">
        <BottomNav />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <PatientProvider>
      <AppShell />
    </PatientProvider>
  )
}

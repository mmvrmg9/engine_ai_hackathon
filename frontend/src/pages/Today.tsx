import { useCallback, useEffect, useState } from 'react'
import { api, type DailyLog, type PatternsResponse } from '../api'
import { usePatientContext } from '../context/PatientContext'
import { DailyLogForm } from '../components/DailyLogForm'
import { EscalationBanner } from '../components/EscalationBanner'
import { VoiceCheckIn } from '../components/VoiceCheckIn'

export function Today() {
  const { selected } = usePatientContext()
  const [patterns, setPatterns] = useState<PatternsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [answerDraft, setAnswerDraft] = useState('')
  const [answeringId, setAnsweringId] = useState<string | null>(null)
  const [justAnswered, setJustAnswered] = useState(false)
  const [logMode, setLogMode] = useState<'manual' | 'voice'>('manual')
  const [voiceStartSignal, setVoiceStartSignal] = useState(0)

  const load = useCallback(async () => {
    if (!selected) return
    setLoading(true)
    try {
      const result = await api.getPatterns(selected.id)
      setPatterns(result)
    } finally {
      setLoading(false)
    }
  }, [selected])

  useEffect(() => {
    load()
  }, [load])

  if (!selected) return null

  const handleLog = async (log: Partial<DailyLog> & { date: string; pain_score: number }) => {
    setSubmitting(true)
    try {
      await api.addDailyLog(selected.id, log)
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  const startVoiceCheckIn = () => {
    setLogMode('voice')
    setVoiceStartSignal((s) => s + 1)
  }

  const pendingQuestion = patterns?.follow_up_questions[0]

  const submitAnswer = async () => {
    if (!pendingQuestion || !answerDraft.trim()) return
    setAnsweringId(pendingQuestion.id)
    try {
      await api.answerFollowUp(pendingQuestion.pattern_id, pendingQuestion.id, answerDraft.trim())
      setJustAnswered(true)
      setAnswerDraft('')
    } finally {
      setAnsweringId(null)
    }
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold text-slate-900">Today</h1>

      {loading && <p className="text-sm text-slate-400">Checking your latest pattern status...</p>}

      {patterns && (
        <>
          <EscalationBanner level={patterns.escalation} reason={patterns.escalation_reason} />

          {patterns.explanation && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Latest pattern status
              </p>
              <p className="text-sm leading-relaxed text-slate-700">{patterns.explanation}</p>
              {patterns.next_step && (
                <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
                  <span className="font-semibold">Safe next step: </span>
                  {patterns.next_step}
                </p>
              )}
            </div>
          )}

          {pendingQuestion && !justAnswered && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-500">
                One quick question
              </p>
              <p className="mb-3 text-sm font-medium text-slate-800">{pendingQuestion.question_text}</p>
              <textarea
                value={answerDraft}
                onChange={(e) => setAnswerDraft(e.target.value)}
                placeholder="Type your answer..."
                rows={2}
                className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={submitAnswer}
                disabled={!answerDraft.trim() || answeringId === pendingQuestion.id}
                className="mt-2 rounded-lg bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {answeringId === pendingQuestion.id ? 'Saving...' : 'Send answer'}
              </button>
            </div>
          )}

          {pendingQuestion && justAnswered && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              Thanks -- that context is saved with your clinician summary.
            </div>
          )}
        </>
      )}

      <div className="flex gap-2 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setLogMode('manual')}
          className={`rounded-full px-3 py-1.5 ${logMode === 'manual' ? 'bg-rose-600 text-white' : 'bg-white text-slate-500'}`}
        >
          Log today
        </button>
        <button
          type="button"
          onClick={() => setLogMode('voice')}
          className={`rounded-full px-3 py-1.5 ${logMode === 'voice' ? 'bg-rose-600 text-white' : 'bg-white text-slate-500'}`}
        >
          Voice check-in
        </button>
      </div>

      {logMode === 'manual' ? (
        <DailyLogForm
          showCycleDay={selected.journey_stage !== 'post_surgical'}
          onSubmit={handleLog}
          submitting={submitting}
        />
      ) : (
        <VoiceCheckIn
          key={selected.id}
          patientId={selected.id}
          onSaved={load}
          startSignal={voiceStartSignal}
        />
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-10 no-print">
        <div className="mx-auto max-w-md px-4">
          <button
            type="button"
            onClick={startVoiceCheckIn}
            className="pointer-events-auto ml-auto block rounded-full bg-rose-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-rose-900/20 transition-colors hover:bg-rose-700"
          >
            Talk to Endo Loop
          </button>
        </div>
      </div>
    </div>
  )
}

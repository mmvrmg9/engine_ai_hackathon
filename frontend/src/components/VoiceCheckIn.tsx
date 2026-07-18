import { useRef, useState } from 'react'
import { api, type VoiceCheckInResult } from '../api'
import { todayISODate } from '../lib/labels'

// Minimal ambient shape for the Web Speech API -- not part of lib.dom.d.ts,
// and only some browsers implement it (hence the runtime feature check).
interface SpeechRecognitionResultLike {
  0: { transcript: string }
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>
}
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onstart: (() => void) | null
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function VoiceCheckIn({
  patientId,
  onSaved,
}: {
  patientId: string
  onSaved: () => void | Promise<void>
}) {
  const [transcript, setTranscript] = useState('')
  const [listening, setListening] = useState(false)
  const [status, setStatus] = useState('Tap the microphone to talk, or type below.')
  const [result, setResult] = useState<VoiceCheckInResult | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const supportsVoice = getSpeechRecognition() !== null

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const Recognition = getSpeechRecognition()
    if (!Recognition) {
      setStatus('Voice recognition is not available in this browser -- you can still type below.')
      return
    }
    const recognition = new Recognition()
    recognitionRef.current = recognition
    recognition.lang = 'en-GB'
    recognition.interimResults = true
    recognition.continuous = true
    recognition.onstart = () => {
      setListening(true)
      setStatus('Listening -- take your time, tap the microphone again when done.')
    }
    recognition.onresult = (e) => {
      setTranscript(Array.from(e.results, (r) => r[0].transcript).join(''))
    }
    recognition.onerror = () => {
      setStatus('Paused listening. Your words are still here -- tap the microphone to continue.')
    }
    recognition.onend = () => {
      setListening(false)
      setStatus('Paused. Review what you said, or tap the microphone to continue.')
    }
    recognition.start()
  }

  const review = async () => {
    if (!transcript.trim()) return
    setReviewing(true)
    setSaved(false)
    try {
      const draft = await api.voiceCheckIn(patientId, { transcript: transcript.trim(), date: todayISODate() })
      setResult(draft)
    } finally {
      setReviewing(false)
    }
  }

  const save = async () => {
    if (!result) return
    setSaving(true)
    try {
      await api.addDailyLog(patientId, result.extracted_log)
      await onSaved()
      setSaved(true)
      setResult(null)
      setTranscript('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
      <div>
        <p className="text-sm font-semibold text-violet-900">Voice check-in</p>
        <p className="text-xs text-violet-700">
          Tell me what today has been like -- pain, sleep, anything else. I'll draft today's log for you to
          review before it's saved.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleListening}
          aria-pressed={listening}
          aria-label={listening ? 'Stop listening' : 'Start talking'}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white transition-colors ${
            listening ? 'animate-pulse bg-emerald-600' : 'bg-violet-600 hover:bg-violet-700'
          }`}
        >
          &#9679;
        </button>
        <p className="text-xs text-slate-500">{status}</p>
      </div>

      {!supportsVoice && (
        <p className="text-xs text-slate-500">
          This browser doesn't support voice input -- typing works exactly the same way.
        </p>
      )}

      <textarea
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        placeholder="e.g. Today has been difficult. The pain is 7 out of 10, low on my left side, and I slept about 4 hours."
        rows={3}
        className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
      />

      <button
        type="button"
        onClick={review}
        disabled={!transcript.trim() || reviewing}
        className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {reviewing ? 'Listening for details...' : 'Continue'}
      </button>

      {result && (
        <div className="space-y-3 rounded-xl border border-violet-200 bg-white p-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">What I heard</p>
            <p className="text-sm text-slate-700">{result.neutral_summary}</p>
          </div>

          {result.follow_up_questions.length > 0 && (
            <div className="rounded-lg bg-violet-50 p-3">
              {result.follow_up_questions.map((q) => (
                <p key={q} className="text-sm text-violet-800">
                  {q}
                </p>
              ))}
              <p className="mt-1 text-xs text-violet-500">
                Add more detail above and tap Continue, or save as-is -- you can edit later.
              </p>
            </div>
          )}

          {result.safety_note && (
            <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{result.safety_note}</p>
          )}

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save check-in'}
          </button>
        </div>
      )}

      {saved && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          Saved -- today's check-in is included in your patterns and clinician summary.
        </p>
      )}
    </div>
  )
}

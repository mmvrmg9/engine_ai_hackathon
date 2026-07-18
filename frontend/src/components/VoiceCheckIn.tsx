import { useEffect, useRef, useState } from 'react'
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
  startSignal,
}: {
  patientId: string
  onSaved: () => void | Promise<void>
  /** Bump this number to (re)start listening from outside, e.g. a quick-access button. */
  startSignal?: number
}) {
  const [input, setInput] = useState('')
  const [conversation, setConversation] = useState('')
  const [listening, setListening] = useState(false)
  const [status, setStatus] = useState('Tap to talk. I will keep listening through natural pauses.')
  const [result, setResult] = useState<VoiceCheckInResult | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const shouldListenRef = useRef(false)
  const supportsVoice = getSpeechRecognition() !== null

  const startListening = () => {
    const Recognition = getSpeechRecognition()
    if (!Recognition) {
      setStatus("Voice recognition is not available in this browser -- you can still type below.")
      return
    }
    shouldListenRef.current = true
    const recognition = new Recognition()
    recognitionRef.current = recognition
    recognition.lang = 'en-GB'
    recognition.interimResults = true
    recognition.continuous = true
    recognition.onstart = () => {
      setListening(true)
      setStatus('Listening. Take your time -- tap the microphone whenever you are ready to pause.')
    }
    recognition.onresult = (e) => {
      setInput(Array.from(e.results, (r) => r[0].transcript).join(''))
    }
    recognition.onerror = () => {
      setStatus('I paused listening. Your words are still here -- tap the microphone to continue.')
    }
    recognition.onend = () => {
      if (shouldListenRef.current) {
        // Chrome ends a recognition session after a natural pause even in
        // continuous mode -- restart it so listening feels uninterrupted
        // until the patient explicitly stops.
        setTimeout(() => {
          try {
            recognition.start()
          } catch {
            // A stop() landed in the same tick as this restart -- ignore.
          }
        }, 350)
      } else {
        setListening(false)
        setStatus('Paused. Review what you said, or tap the microphone to continue.')
      }
    }
    recognition.start()
  }

  const stopListening = () => {
    shouldListenRef.current = false
    recognitionRef.current?.stop()
    setListening(false)
  }

  const toggleListening = () => {
    if (listening) stopListening()
    else startListening()
  }

  useEffect(() => {
    if (startSignal && !listening) startListening()
    return () => {
      shouldListenRef.current = false
      recognitionRef.current?.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSignal])

  const review = async () => {
    const newWords = input.trim()
    if (!newWords) return
    const fullConversation = conversation ? `${conversation} ${newWords}` : newWords
    setConversation(fullConversation)
    setInput('')
    setSaved(false)
    setReviewing(true)
    try {
      const draft = await api.voiceCheckIn(patientId, { transcript: fullConversation, date: todayISODate() })
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
      setConversation('')
      setInput('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
      <div>
        <p className="text-sm font-semibold text-rose-900">Voice check-in</p>
        <p className="text-xs text-rose-700">
          Tell me what today has been like -- pain, sleep, anything else. Take your time; I'll ask up to
          two gentle follow-up questions and always show you a draft to review before it's saved.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleListening}
          aria-pressed={listening}
          aria-label={listening ? 'Pause listening' : 'Start talking'}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white transition-colors ${
            listening ? 'animate-pulse bg-emerald-600' : 'bg-rose-600 hover:bg-rose-700'
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
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Start wherever feels easiest. For example: Today has been difficult. The pain is 7 out of 10, low on my left side, and I slept about 4 hours."
        rows={3}
        className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
      />

      <button
        type="button"
        onClick={review}
        disabled={!input.trim() || reviewing}
        className="rounded-lg bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {reviewing ? 'Listening for details...' : 'Continue conversation'}
      </button>

      {result && (
        <div className="space-y-3 rounded-xl border border-rose-200 bg-white p-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">What I've heard so far</p>
            <p className="text-sm text-slate-700">{result.neutral_summary}</p>
          </div>

          {result.follow_up_questions.length > 0 ? (
            <div className="rounded-lg bg-rose-50 p-3">
              {result.follow_up_questions.map((q) => (
                <p key={q} className="text-sm text-rose-800">
                  {q}
                </p>
              ))}
              <p className="mt-1 text-xs text-rose-500">
                Answer above and tap Continue conversation to add more, or save as-is -- you can edit later.
              </p>
            </div>
          ) : (
            <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              Thank you -- you've shared the key details for this check-in.
            </p>
          )}

          {result.safety_note && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{result.safety_note}</p>
          )}

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
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

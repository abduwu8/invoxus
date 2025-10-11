import { useState, useRef, useEffect } from 'react'
import { X, Send, ThumbsUp, ThumbsDown } from 'lucide-react'
import { PlaceholdersAndVanishInput } from '../../ui/reveal'
import type { ChatMessage, PendingSend } from '../types'

type ChatModalProps = {
  onClose: () => void
  suggestions: string[]
  history: ChatMessage[]
  pendingSend: PendingSend | null
  onCancelPendingSend: () => void
  onConfirmSend: (p: { to: string; subject: string; body: string }) => Promise<boolean>
  onAsk: (q: string) => Promise<void>
}

export function ChatModal({
  onClose,
  suggestions,
  history,
  pendingSend,
  onCancelPendingSend,
  onConfirmSend,
  onAsk,
}: ChatModalProps) {
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const [showFeedback, setShowFeedback] = useState<null | number>(null)
  const showExamples = history.length === 0 && value.trim().length === 0
  const messagesRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = messagesRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [history, sending])

  useEffect(() => {
    if (history.length > 0) {
      const last = history[history.length - 1]
      if (last.role === 'assistant') {
        setShowFeedback(Date.now())
      }
    }
  }, [history])

  return (
    <div className="fixed inset-0 md:inset-auto md:right-6 md:bottom-6 z-50 flex md:block">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm md:hidden" onClick={onClose} />
      <div className="relative w-full h-full md:h-[85vh] md:max-h-[90vh] md:w-[520px] md:max-w-[92vw] rounded-none md:rounded-3xl border border-white/10 bg-black shadow-2xl overflow-hidden flex flex-col ml-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black">
          <div>
            <div className="text-base font-semibold text-white">Assistant</div>
            <div className="text-xs text-gray-400">AI-powered email help</div>
          </div>
          <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors" onClick={onClose}>
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
        <div className="flex flex-col h-full">
          <div className="px-6 py-4 flex flex-col gap-4 flex-1 overflow-hidden">
            {showExamples ? (
              <>
                <div className="text-center py-8">
                  <div className="text-lg font-medium text-white mb-2">How can I help you today?</div>
                  <div className="text-sm text-gray-400">Ask me anything about your emails</div>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      className="text-left px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm transition-colors"
                      onClick={() => setValue(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {/* Messages */}
            <div ref={messagesRef} className="space-y-4 flex-1 overflow-y-auto pr-2 no-scrollbar">
              {history.slice(-12).map((m, idx) => (
                <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                      m.role === 'user'
                        ? 'bg-white text-black'
                        : 'bg-white/10 text-white border border-white/20'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {sending ? (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm bg-white/5 text-gray-400 border border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-white/40 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-white/40 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                      <div className="w-2 h-2 bg-white/40 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Preview & send panel */}
            {pendingSend ? (
              <div className="mt-2">
                <PendingSendForm
                  draft={pendingSend}
                  onCancel={onCancelPendingSend}
                  onConfirm={onConfirmSend}
                />
              </div>
            ) : null}

            {/* Feedback */}
            {showFeedback ? (
              <div className="flex items-center justify-end gap-1 pb-2">
                <button
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 hover:bg-white/10 transition-colors"
                  title="Good answer"
                  aria-label="Thumbs up"
                  onClick={() => {
                    setShowFeedback(null)
                    fetch('/api/chat/feedback', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vote: 'up' }) }).catch(() => {})
                  }}
                >
                  <ThumbsUp className="size-4 text-white" />
                </button>
                <button
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 hover:bg-white/10 transition-colors"
                  title="Needs work"
                  aria-label="Thumbs down"
                  onClick={() => {
                    setShowFeedback(null)
                    fetch('/api/chat/feedback', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vote: 'down' }) }).catch(() => {})
                  }}
                >
                  <ThumbsDown className="size-4 text-white" />
                </button>
              </div>
            ) : null}
          </div>

          {/* Input - Fixed at bottom */}
          <div className="px-6 py-4 border-t border-white/10 bg-black">
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-2xl border border-white/20 bg-white/5 p-3">
                <PlaceholdersAndVanishInput
                  placeholders={[
                    'Find emails from Alice about invoices',
                    'Summarize last week from John',
                    'Email Nick a thank you note',
                    'Schedule a follow up for tomorrow 9am',
                  ]}
                  onChange={(e) => setValue(e.target.value)}
                  onSubmit={async (e) => {
                    e.preventDefault()
                    const q = value.trim()
                    if (!q || sending) return
                    setValue('')
                    setSending(true)
                    await onAsk(q)
                    setSending(false)
                  }}
                />
              </div>
              <button
                disabled={!value.trim() || sending}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-black hover:bg-white/90 disabled:opacity-50 transition-colors"
                onClick={async () => {
                  const q = value.trim()
                  if (!q) return
                  setValue('')
                  setSending(true)
                  await onAsk(q)
                  setSending(false)
                }}
                title="Send"
                aria-label="Send"
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// PendingSendForm Component
function PendingSendForm({
  draft,
  onCancel,
  onConfirm,
}: {
  draft: { toEmail: string; subject: string; body: string }
  onCancel: () => void
  onConfirm: (p: { to: string; subject: string; body: string }) => Promise<boolean>
}) {
  const [to, setTo] = useState(draft.toEmail)
  const [subject, setSubject] = useState(draft.subject)
  const [body, setBody] = useState(draft.body)
  const [sending, setSending] = useState(false)
  
  return (
    <div className="rounded-lg border border-neutral-800 p-3 bg-neutral-950/60">
      <div className="text-xs text-neutral-400 mb-2">Preview & send</div>
      <div className="flex items-center gap-2 mb-2">
        <label className="w-12 text-xs text-neutral-500">To</label>
        <input
          className="flex-1 h-8 rounded-md bg-neutral-900 border border-neutral-800 px-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2 mb-2">
        <label className="w-12 text-xs text-neutral-500">Subject</label>
        <input
          className="flex-1 h-8 rounded-md bg-neutral-900 border border-neutral-800 px-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>
      <div>
        <textarea
          className="min-h-[120px] w-full resize-y rounded-md bg-neutral-900 border border-neutral-800 px-2 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      <div className="mt-2 flex items-center justify-end gap-2">
        <button className="rounded-md border border-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-900" onClick={onCancel}>
          Cancel
        </button>
        <button
          disabled={sending || !to.trim()}
          className="rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-1.5 text-sm"
          onClick={async () => {
            try {
              setSending(true)
              const ok = await onConfirm({ to, subject, body })
              if (ok) {
                setTo(''); setSubject(''); setBody('')
              }
            } finally {
              setSending(false)
            }
          }}
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  )
}


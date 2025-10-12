import { useState, useRef, useEffect } from 'react'
import { X, Send, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react'
import { PlaceholdersAndVanishInput } from '../../ui/reveal'
import type { ChatMessage, PendingSend } from '../types'

type ChatModalProps = {
  onClose: () => void
  suggestions: string[]
  history: ChatMessage[]
  pendingSend: PendingSend | null
  onCancelPendingSend: () => void
  onConfirmSend: (p: { to: string; subject: string; body: string }) => Promise<boolean>
  onAsk: (q: string, limit?: number) => Promise<void>
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
  const [scanLimit, setScanLimit] = useState<25 | 50 | 100>(50)
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
      <div className="relative w-full h-full md:h-[85vh] md:max-h-[90vh] md:w-[520px] md:max-w-[92vw] rounded-none md:rounded-3xl border border-white/10 bg-black shadow-2xl flex flex-col ml-auto">
        {/* Header - Fixed */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black">
          <div className="flex-1">
            <div className="text-base font-semibold text-white">Assistant</div>
            <div className="text-xs text-gray-400">AI-powered email help</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Scan:</span>
              <select
                value={scanLimit}
                onChange={(e) => setScanLimit(Number(e.target.value) as 25 | 50 | 100)}
                className="text-xs bg-white/5 border border-white/20 rounded-lg px-2 py-1 text-white outline-none hover:bg-white/10 focus:ring-1 focus:ring-white/30 cursor-pointer [&>option]:bg-gray-900 [&>option]:text-white"
              >
                <option value="25" className="bg-gray-900 text-white">25 emails</option>
                <option value="50" className="bg-gray-900 text-white">50 emails</option>
                <option value="100" className="bg-gray-900 text-white">100 emails</option>
              </select>
            </div>
            <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors" onClick={onClose}>
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
        
        {/* Messages Area - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex flex-col gap-4 min-h-full">
            {showExamples ? (
              <>
                <div className="text-center py-8">
                  <div className="text-lg font-medium text-white mb-2">🚀 Business Email Assistant</div>
                  <div className="text-sm text-gray-400">AI-powered email intelligence for professionals</div>
                </div>
                
                {/* Quick Action Buttons */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 text-orange-200 text-sm transition-colors"
                    onClick={() => setValue("Show me urgent emails that need action")}
                  >
                    <span className="text-lg">⚡</span>
                    <span>Urgent Items</span>
                  </button>
                  <button
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-200 text-sm transition-colors"
                    onClick={() => setValue("Summarize my emails from today")}
                  >
                    <span className="text-lg">📊</span>
                    <span>Daily Summary</span>
                  </button>
                  <button
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 text-sm transition-colors"
                    onClick={() => setValue("Show me emails with invoices or payments")}
                  >
                    <span className="text-lg">💰</span>
                    <span>Financial</span>
                  </button>
                  <button
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 text-green-200 text-sm transition-colors"
                    onClick={() => setValue("Show me unanswered client emails")}
                  >
                    <span className="text-lg">👥</span>
                    <span>Clients</span>
                  </button>
                </div>
                
                <div className="border-t border-white/10 pt-4 mt-2">
                  <div className="text-xs text-gray-500 mb-2 font-medium">💡 TRY THESE QUERIES</div>
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
                </div>
              </>
            ) : null}

            {/* Messages */}
            <div ref={messagesRef} className="space-y-4">
              {history.slice(-12).map((m, idx) => (
                <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
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
                  <div className="rounded-2xl px-4 py-3 text-sm bg-white/5 border border-white/10">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                      <span className="text-white/80">Scanning {scanLimit} emails...</span>
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
              <div className="flex items-center justify-end gap-1 pb-2 mt-2">
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
        </div>

        {/* Input - Fixed at bottom */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-white/10 bg-black">
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-2xl border border-white/20 bg-white/5 p-3">
                <PlaceholdersAndVanishInput
                  placeholders={[
                    'Show me urgent invoices that need payment...',
                    'Summarize client emails from this week...',
                    'Find contracts that need my signature...',
                    'What are my pending action items?',
                    'Show me unanswered emails from VIP clients...',
                    'Analyze meeting requests from last 3 days...',
                  ]}
                  onChange={(e) => setValue(e.target.value)}
                  onSubmit={async (e) => {
                    e.preventDefault()
                    const q = value.trim()
                    if (!q || sending) return
                    setValue('')
                    setSending(true)
                    await onAsk(q, scanLimit)
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
                  await onAsk(q, scanLimit)
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


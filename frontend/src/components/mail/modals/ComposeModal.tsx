import { useState, useRef, useEffect, useMemo } from 'react'
import { X, Send, Paperclip } from 'lucide-react'
import { API_BASE } from '../utils'

type ComposeModalProps = {
  onClose: () => void
  onSend: (payload: {
    to: string
    cc?: string
    bcc?: string
    subject: string
    body: string
    attachments?: Array<{ filename: string; contentType?: string; dataBase64: string }>
  }) => Promise<void>
}

export function ComposeModal({ onClose, onSend }: ComposeModalProps) {
  const [to, setTo] = useState('')
  const [suggestions, setSuggestions] = useState<Array<{ name: string; email: string }>>([])
  const [showSuggest, setShowSuggest] = useState(false)
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [attachments, setAttachments] = useState<Array<{ filename: string; contentType?: string; dataBase64: string }>>([])
  const [sending, setSending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    // 1) Load from localStorage cache first for instant suggestions
    try {
      const raw = localStorage.getItem('invoxus_contacts_cache_v1')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length) setSuggestions(parsed)
      }
    } catch {}
    // 2) Refresh contacts in the background
    ;(async () => {
      try {
        const r = await fetch(`${API_BASE}/api/gmail/contacts?limit=600`, { credentials: 'include' })
        if (r.ok) {
          const j = await r.json()
          const list = (j.contacts || []).map((c: any) => ({ name: c.name, email: c.email }))
          setSuggestions(list)
          try { localStorage.setItem('invoxus_contacts_cache_v1', JSON.stringify(list)) } catch {}
          return
        }
        // Fallback: build from recent messages
        const r2 = await fetch(`${API_BASE}/api/gmail/messages?limit=200`, { credentials: 'include' })
        if (!r2.ok) return
        const j2 = await r2.json()
        const set = new Map<string, { name: string; email: string }>()
        for (const m of (j2.messages || [])) {
          const pair = [m.from || '', m.to || '']
          for (const val of pair) {
            if (!val) continue
            const matches = String(val).split(',').map((s: string) => s.trim()).filter(Boolean)
            for (const v of matches) {
              const em = v.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
              const email = em ? em[0] : ''
              if (!email) continue
              const nm = v.match(/"?([^"<]+)"?\s*<.+?>/)
              const name = (nm ? nm[1] : v.split('<')[0]).trim()
              const key = `${name}|${email}`.toLowerCase()
              if (!set.has(key)) set.set(key, { name, email })
            }
          }
        }
        const list = Array.from(set.values()).slice(0, 500)
        setSuggestions(list)
        try { localStorage.setItem('invoxus_contacts_cache_v1', JSON.stringify(list)) } catch {}
      } catch {}
    })()
  }, [])

  const preprocessed = useMemo(() => {
    return suggestions.map((c) => ({ name: c.name, email: c.email, ln: c.name.toLowerCase(), le: c.email.toLowerCase() })) as Array<{ name: string; email: string; ln: string; le: string }>
  }, [suggestions])

  const filtered = useMemo(() => {
    const q = to.trim().toLowerCase()
    if (!q) return []
    return preprocessed.filter((c) => c.ln.includes(q) || c.le.includes(q)).slice(0, 10)
  }, [to, preprocessed])

  async function handlePickFiles(ev: React.ChangeEvent<HTMLInputElement>) {
    const files = ev.target.files
    if (!files || !files.length) return
    const next: Array<{ filename: string; contentType?: string; dataBase64: string }> = []
    for (const f of Array.from(files)) {
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('read error'))
        reader.readAsDataURL(f)
      })
      next.push({ filename: f.name, contentType: f.type || undefined, dataBase64: b64 })
    }
    setAttachments((arr) => [...arr, ...next])
    ev.target.value = ''
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch md:items-start justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full h-full md:h-auto md:mt-10 max-w-none md:max-w-2xl rounded-none md:rounded-xl border border-neutral-800 bg-neutral-950 flex flex-col">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-800 px-4 py-3 bg-neutral-950/95">
          <div className="text-sm text-neutral-300">New message</div>
          <button className="size-8 grid place-items-center rounded-md hover:bg-neutral-900" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 relative">
            <label className="w-16 text-xs text-neutral-500">To</label>
            <input
              value={to}
              onChange={(e) => { setTo(e.target.value); setShowSuggest(true) }}
              placeholder="recipient@example.com"
              className="flex-1 rounded-md bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700"
            />
            {showSuggest && filtered.length > 0 ? (
              <div className="absolute left-16 right-0 top-full mt-1 rounded-md border border-neutral-800 bg-neutral-950 shadow-lg z-10">
                <ul className="max-h-56 overflow-auto py-1">
                  {filtered.map((c, i) => (
                    <li key={`${c.email}-${i}`}>
                      <button
                        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-neutral-900"
                        onClick={() => { setTo(c.email); setShowSuggest(false) }}
                      >
                        <span className="text-neutral-200 truncate">{c.name}</span>
                        <span className="text-neutral-400 truncate">{c.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs text-neutral-500">Cc</label>
            <input
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="cc@example.com"
              className="flex-1 rounded-md bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs text-neutral-500">Bcc</label>
            <input
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              placeholder="bcc@example.com"
              className="flex-1 rounded-md bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs text-neutral-500">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="flex-1 rounded-md bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700"
            />
          </div>
          <div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message…"
              className="min-h-[180px] w-full resize-y rounded-md bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700"
            />
          </div>
          <div className="relative flex items-center gap-2 pt-1">
            <label className="w-16 text-xs text-neutral-500">Insert</label>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-neutral-800 px-2 py-1 text-xs hover:bg-neutral-900"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="size-3.5" />
              Add files
            </button>
            <input ref={fileInputRef} type="file" multiple onChange={handlePickFiles} className="hidden" />
          </div>
          {attachments.length ? (
            <div className="pl-16 text-xs text-neutral-400 flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <span key={`${a.filename}-${i}`} className="inline-flex items-center gap-1 rounded border border-neutral-700 px-2 py-0.5">
                  {a.filename}
                  <button onClick={() => setAttachments((arr) => arr.filter((_, j) => j !== i))} className="text-neutral-500 hover:text-neutral-200">×</button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-neutral-800 px-4 py-3 bg-neutral-950/95">
          <button className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-900" onClick={onClose}>
            Cancel
          </button>
          <button
            disabled={sending || !to.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-1.5 text-sm"
            onClick={async () => {
              try {
                setSending(true)
                await onSend({ to, cc: cc || undefined, bcc: bcc || undefined, subject, body, attachments })
              } finally {
                setSending(false)
              }
            }}
          >
            <Send className="size-4" />
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

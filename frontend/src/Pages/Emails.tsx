import { useEffect, useState } from 'react'

type EmailItem = {
  id: string
  threadId: string
  subject: string
  from: string
  date: string
  snippet: string
  importance?: 'high' | 'medium' | 'low'
  summary?: string
}

const API_BASE = import.meta.env.PROD ? '' : ((import.meta.env.VITE_API_BASE as string) || 'http://localhost:4000')

export default function Emails({ onOpen }: { onOpen?: (id: string) => void }) {
  const [emails, setEmails] = useState<EmailItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const resp = await fetch(`${API_BASE}/api/gmail/messages?summarize=1`, {
          credentials: 'include',
        })
        if (!resp.ok) {
          throw new Error(`Failed: ${resp.status}`)
        }
        const data = await resp.json()
        setEmails(data.messages || [])
      } catch (e: any) {
        setError(e?.message || 'Failed to load emails')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <div style={{ padding: 24 }}>Loading emails…</div>
  if (error) return <div style={{ padding: 24, color: 'crimson' }}>{error}</div>

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Your recent emails</h2>
      <ul style={{ display: 'grid', gap: 12 }}>
        {emails.map((m) => (
          <li
            key={m.id}
            style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, cursor: 'pointer' }}
            onClick={() => onOpen?.(m.id)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontWeight: 600 }}>{m.subject || '(No subject)'}</div>
              <div style={{ color: '#666' }}>{m.date}</div>
            </div>
            <div style={{ color: '#444' }}>{m.from}</div>
            <div style={{ color: '#666', marginTop: 8 }}>{m.snippet}</div>
            {m.summary ? (
              <div style={{ marginTop: 8, fontSize: 14 }}>
                <strong>AI Summary:</strong> {m.summary}
              </div>
            ) : null}
            {m.importance ? (
              <span
                style={{
                  marginTop: 8,
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 999,
                  background:
                    m.importance === 'high' ? '#fde68a' : m.importance === 'medium' ? '#e5e7eb' : '#f3f4f6',
                  border: '1px solid #e5e7eb',
                }}
              >
                {m.importance.toUpperCase()}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}



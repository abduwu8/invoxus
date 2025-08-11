import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.PROD ? '' : ((import.meta.env.VITE_API_BASE as string) || 'http://localhost:4000')

type MessageDetail = {
  id: string
  subject: string
  from: string
  to: string
  date: string
  bodyHtml?: string
  bodyText?: string
  summary?: string
  importance?: 'high' | 'medium' | 'low'
}

export default function EmailDetail({ id, onBack }: { id: string; onBack?: () => void }) {
  const [data, setData] = useState<MessageDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summarizing, setSummarizing] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const resp = await fetch(`${API_BASE}/api/gmail/messages/${id}`, { credentials: 'include' })
        if (!resp.ok) throw new Error(`Failed: ${resp.status}`)
        const json = await resp.json()
        setData(json)
      } catch (e: any) {
        setError(e?.message || 'Failed to load message')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>
  if (error) return <div style={{ padding: 24, color: 'crimson' }}>{error}</div>
  if (!data) return null

  return (
    <div style={{ padding: 24, display: 'grid', gap: 12 }}>
      <button
        onClick={onBack}
        style={{ width: 90, background: '#eee', border: '1px solid #ddd', borderRadius: 6, padding: '6px 10px' }}
      >
        ← Back
      </button>
      <h2 style={{ fontSize: 22, fontWeight: 700 }}>{data.subject || '(No subject)'}</h2>
      <div style={{ color: '#444' }}>From: {data.from}</div>
      <div style={{ color: '#444' }}>To: {data.to}</div>
      <div style={{ color: '#666' }}>{data.date}</div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          disabled={summarizing}
          onClick={async () => {
            try {
              setSummarizing(true)
              const resp = await fetch(`${API_BASE}/api/gmail/messages/${id}/summarize`, {
                method: 'POST',
                credentials: 'include',
              })
              const json = await resp.json()
              setData((prev) => (prev ? { ...prev, summary: json.summary, importance: json.importance } : prev))
            } catch (e) {
              console.error(e)
              import('sonner').then(({ toast }) => toast.error('Failed to summarize'))
            } finally {
              setSummarizing(false)
            }
          }}
          style={{ background: '#1a73e8', color: 'white', border: 0, borderRadius: 6, padding: '6px 10px' }}
        >
          {summarizing ? 'Summarizing…' : 'Summarize with AI'}
        </button>
        {data.importance ? (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 999,
              background:
                data.importance === 'high' ? '#fde68a' : data.importance === 'medium' ? '#e5e7eb' : '#f3f4f6',
              border: '1px solid #e5e7eb',
            }}
          >
            {data.importance.toUpperCase()}
          </span>
        ) : null}
      </div>
      {data.summary ? (
        <div style={{ marginTop: 6 }}>
          <strong>AI Summary:</strong> {data.summary}
        </div>
      ) : null}
      <div style={{ marginTop: 16 }}>
        {data.bodyHtml ? (
          <div dangerouslySetInnerHTML={{ __html: data.bodyHtml }} />
        ) : (
          <pre style={{ whiteSpace: 'pre-wrap' }}>{data.bodyText}</pre>
        )}
      </div>
    </div>
  )
}



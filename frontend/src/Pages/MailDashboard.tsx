import { useEffect, useMemo, useRef, useState } from 'react'
import { Star, Reply as LucideReply, Trash2, Wand2, Send, X, Plus, Inbox, MessageSquare, Bot, Sparkles, CheckSquare, KeyRound, LogOut, Menu, ArrowLeft, ThumbsUp, ThumbsDown } from 'lucide-react'
import { PlaceholdersAndVanishInput } from '../components/ui/reveal'

type Importance = 'high' | 'medium' | 'low'

type EmailListItem = {
  id: string
  threadId: string
  subject: string
  from: string
  date: string
  snippet: string
  summary?: string
  importance?: Importance
  unread?: boolean
  isStarred?: boolean
}

type EmailDetail = {
  id: string
  subject: string
  from: string
  to: string
  date: string
  bodyHtml?: string
  bodyText?: string
  summary?: string
  importance?: Importance
  avatar?: string
  isStarred?: boolean
}

const API_BASE = import.meta.env.PROD ? '' : ((import.meta.env.VITE_API_BASE as string) || 'http://localhost:4000')

function buildApiUrl(path: string): URL {
  // Ensure a valid absolute URL in both dev and prod
  const base = API_BASE || window.location.origin
  return new URL(path, base)
}

export default function MailDashboard() {
  type UserProfile = { name?: string; email?: string; picture?: string }
  const [emails, setEmails] = useState<EmailListItem[]>([])
  const [sentCount, setSentCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<EmailDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [summaryExpanded, setSummaryExpanded] = useState(true)
  const [summarizing, setSummarizing] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [threadMessages, setThreadMessages] = useState<Array<{
    id: string
    from: string
    to: string
    date: string
    bodyHtml?: string
    bodyText?: string
  }>>([])
  const [composeOpen, setComposeOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [categoryMessageIds, setCategoryMessageIds] = useState<Set<string>>(new Set())
  const [categories, setCategories] = useState<Array<{ _id: string; name: string }>>([])
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)
  // Sidebar chat opens a modal; keep only modal state
  // chatLoading managed inside ChatModal callbacks when needed
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([])
  const [chatModalOpen, setChatModalOpen] = useState(false)
  const [chatPendingSend, setChatPendingSend] = useState<null | { toEmail: string; subject: string; body: string }>(null)
  const [coldOpen, setColdOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showingSuggestions, setShowingSuggestions] = useState(false)
  const [showingOtps, setShowingOtps] = useState(false)
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set())
  const [aiDeleteMode, setAiDeleteMode] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const chatSuggestions = [
    'Recent design feedback',
    'Reply to Nick',
    'Find invoice from Stripe',
    'Schedule meeting with Sarah',
    'What did Alex say about the demo?',
  ]

  async function addToCategory(categoryId: string, messageId: string) {
    try {
      const r = await fetch(`${API_BASE}/api/gmail/categories/${categoryId}/mails`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId }),
      })
      if (!r.ok) throw new Error('Request failed')
      // If currently viewing this category, refresh messageIds so it appears at once
      if (selectedCategory === categoryId) {
        await loadCategoryMessageIds(categoryId)
      }
      // toast: Added to category
      import('sonner').then(({ toast }) => toast.success('Added to category'))
    } catch (e) {
      import('sonner').then(({ toast }) => toast.error('Failed to add to category'))
    }
  }

  async function loadCategories() {
    try {
      const r = await fetch(`${API_BASE}/api/gmail/categories`, { credentials: 'include' })
      if (!r.ok) return
      const j = await r.json()
      setCategories(j.categories || [])
    } catch {}
  }

  async function loadCategoryMessageIds(catId: string) {
    try {
      const r = await fetch(`${API_BASE}/api/gmail/categories/${catId}/mails`, { credentials: 'include' })
      if (!r.ok) return
      const j = await r.json()
      setCategoryMessageIds(new Set<string>((j.messageIds as string[]) || []))
    } catch {}
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const resp = await fetch(`${API_BASE}/api/gmail/messages`, { credentials: 'include' })
        if (!resp.ok) throw new Error(`Failed: ${resp.status}`)
        const json = await resp.json()
        if (!cancelled) setEmails(json.messages || [])
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load emails')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    ;(async () => {
      try {
        const r = await fetch(`${API_BASE}/api/gmail/messages?limit=100&folder=sent`, { credentials: 'include' })
        if (!r.ok) return
        const j = await r.json()
        if (!cancelled) setSentCount(Array.isArray(j.messages) ? j.messages.length : 0)
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Load categories for Add-to-category menu
  useEffect(() => {
    loadCategories()
  }, [])

  // When selecting a category from sidebar, fetch its message ids for filtering
  useEffect(() => {
    if (selectedCategory) loadCategoryMessageIds(selectedCategory)
    else setCategoryMessageIds(new Set())
  }, [selectedCategory])

  // Fetch signed-in user's profile for sidebar header
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' })
        if (!r.ok) return
        const j = await r.json()
        if (!cancelled) setProfile(j.profile || null)
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setDetail(null)
    setSummarizing(false)
    setDetailLoading(true)
    ;(async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/gmail/messages/${selectedId}`, { credentials: 'include' })
        if (!resp.ok) throw new Error(`Failed: ${resp.status}`)
        const json = (await resp.json()) as EmailDetail
        if (!cancelled) setDetail(json)
        // Fetch thread messages for the conversation view
        try {
          const t = await fetch(`${API_BASE}/api/gmail/messages/${selectedId}/thread`, { credentials: 'include' })
          if (t.ok) {
            const tj = await t.json()
            if (!cancelled && Array.isArray(tj.messages)) setThreadMessages(tj.messages)
          }
        } catch {}
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load message')
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const leftItems = useMemo(
    () => [
      { key: 'inbox', label: 'Inbox', count: emails.length, Icon: Inbox },
      { key: 'sent', label: 'Sent', count: sentCount, Icon: Send },
    ],
    [emails.length, sentCount],
  )

  const searchFilter = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (m: EmailListItem) => {
      if (!q) return true
      return (
        (m.subject || '').toLowerCase().includes(q) ||
        (m.from || '').toLowerCase().includes(q) ||
        (m.snippet || '').toLowerCase().includes(q)
      )
    }
  }, [search])

  const pinnedItems = useMemo(() => {
    return emails.filter(searchFilter).filter((m) => !!m.isStarred)
  }, [emails, searchFilter])

  const primaryItems = useMemo(() => {
    return emails
      .filter(searchFilter)
      .filter((m) => !m.isStarred)
      .filter((m) => !String(m.subject || '').toLowerCase().startsWith('re: '))
      .filter((m) => (selectedCategory ? categoryMessageIds.has(m.id) : true))
  }, [emails, searchFilter, selectedCategory, categoryMessageIds])

  const shownIds = useMemo(() => new Set<string>([...pinnedItems, ...primaryItems].map((m) => m.id)), [pinnedItems, primaryItems])

  function toggleSelected(id: string) {
    setSelectedForDelete((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleLeftItemClick(key: string, onAfterAction?: () => void) {
    if (key === 'inbox') {
      setSelectedCategory(null)
      setAiDeleteMode(false)
      setSelectedForDelete(new Set())
      setShowingSuggestions(false)
      setShowingOtps(false)
      try {
        setLoading(true)
        const resp = await fetch(`${API_BASE}/api/gmail/messages?limit=100`, { credentials: 'include' })
        const json = await resp.json()
        setEmails(json.messages || [])
      } catch (e) {
        setError('Failed to load')
      } finally {
        setLoading(false)
      }
    }
    if (key === 'sent') {
      setSelectedCategory(null)
      setAiDeleteMode(false)
      setSelectedForDelete(new Set())
      setShowingSuggestions(false)
      setShowingOtps(false)
      try {
        setLoading(true)
        const resp = await fetch(`${API_BASE}/api/gmail/messages?limit=100&folder=sent`, { credentials: 'include' })
        const json = await resp.json()
        setEmails(json.messages || [])
        setSentCount(Array.isArray(json.messages) ? json.messages.length : 0)
      } catch (e) {
        setError('Failed to load')
      } finally {
        setLoading(false)
      }
    }
    onAfterAction?.()
  }

  async function handleShowOtps(onAfterAction?: () => void) {
    try {
      setSelectedCategory(null)
      setAiDeleteMode(false)
      setSelectedForDelete(new Set())
      setShowingSuggestions(false)
      setShowingOtps(true)
      setLoading(true)
      const r = await fetch(`${API_BASE}/api/gmail/messages/otps?limit=300`, { credentials: 'include' })
      if (r.ok) {
        const j = await r.json()
        setEmails(j.messages || [])
      }
    } catch {
    } finally {
      setLoading(false)
      onAfterAction?.()
    }
  }

  async function handleShowAiDelete(onAfterAction?: () => void) {
    try {
      setSelectedCategory(null)
      setAiDeleteMode(true)
      setSelectedForDelete(new Set())
      setShowingSuggestions(true)
      setShowingOtps(false)
      setLoading(true)
      const url = buildApiUrl('/api/gmail/messages/suggest-deletions')
      url.searchParams.set('limit', '200')
      if (search.trim()) url.searchParams.set('q', search.trim())
      const r = await fetch(url.toString(), { credentials: 'include' })
      if (r.ok) {
        const j = await r.json()
        setEmails(j.messages || [])
      }
    } catch {
    } finally {
      setLoading(false)
      onAfterAction?.()
    }
  }

  return (
    <div className="h-screen w-full overflow-x-hidden bg-neutral-950 text-neutral-100 no-anim">
      <div className="flex h-full overflow-x-hidden">
        {/* Mobile slide-over sidebar */}
        {sidebarOpen ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-neutral-800 bg-neutral-950 p-3 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-neutral-400">Menu</div>
                <button
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-neutral-900"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close menu"
                >
                  <X className="size-4" />
                </button>
              </div>
              <SidebarContent
                profile={profile}
                leftItems={leftItems}
                onCompose={() => { setComposeOpen(true); setSidebarOpen(false) }}
                onLeftItemClick={(key) => handleLeftItemClick(key, () => setSidebarOpen(false))}
                onShowOtps={() => handleShowOtps(() => setSidebarOpen(false))}
                onShowAiDelete={() => handleShowAiDelete(() => setSidebarOpen(false))}
                categories={categories}
                onAddCategory={async (name) => {
                  const r = await fetch(`${API_BASE}/api/gmail/categories`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name }),
                  })
                  if (r.ok) await loadCategories()
                }}
                onRemoveCategory={async (id) => {
                  const r = await fetch(`${API_BASE}/api/gmail/categories/${id}`, {
                    method: 'DELETE',
                    credentials: 'include',
                  })
                  if (r.ok) await loadCategories()
                }}
                onSelectCategory={(catId) => {
                  setSelectedCategory(catId)
                  setAiDeleteMode(false)
                  setShowingOtps(false)
                  setShowingSuggestions(false)
                  setSelectedForDelete(new Set())
                  setSidebarOpen(false)
                }}
                onOpenChat={() => { setChatModalOpen(true); setSidebarOpen(false) }}
                onOpenCold={() => { setColdOpen(true); setSidebarOpen(false) }}
              />
            </div>
          </div>
        ) : null}
        {/* Left sidebar (desktop) */}
        <aside className="hidden md:flex h-full w-64 border-r border-neutral-800 p-3 flex-col bg-neutral-950/40">
          <SidebarContent
            profile={profile}
            leftItems={leftItems}
            onCompose={() => setComposeOpen(true)}
            onLeftItemClick={(key) => handleLeftItemClick(key)}
            onShowOtps={() => handleShowOtps()}
            onShowAiDelete={() => handleShowAiDelete()}
            categories={categories}
            onAddCategory={async (name) => {
              const r = await fetch(`${API_BASE}/api/gmail/categories`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
              })
              if (r.ok) await loadCategories()
            }}
            onRemoveCategory={async (id) => {
              const r = await fetch(`${API_BASE}/api/gmail/categories/${id}`, {
                method: 'DELETE',
                credentials: 'include',
              })
              if (r.ok) await loadCategories()
            }}
            onSelectCategory={(catId) => {
              setSelectedCategory(catId)
              setAiDeleteMode(false)
              setShowingOtps(false)
              setShowingSuggestions(false)
              setSelectedForDelete(new Set())
            }}
            onOpenChat={() => setChatModalOpen(true)}
            onOpenCold={() => setColdOpen(true)}
          />
        </aside>

        {/* Middle list */}
        <section className={`${selectedId ? 'hidden md:flex' : 'flex'} w-full md:w-[420px] border-r border-neutral-800 flex-col`}>
          <div className="p-3 border-b border-neutral-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
            {/* Mobile hamburger */}
            <button
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-800 hover:bg-neutral-900"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              title="Menu"
            >
              <Menu className="size-5" />
            </button>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  const q = search.trim()
                  if (!q) return
                  try {
                    setLoading(true)
                    const r = await fetch(`${API_BASE}/api/gmail/messages?limit=100&q=${encodeURIComponent(q)}`, { credentials: 'include' })
                    if (!r.ok) throw new Error('Search failed')
                    const j = await r.json()
                    setEmails(j.messages || [])
                    setShowingSuggestions(false)
                    setSelectedForDelete(new Set())
                  } catch (err) {
                    setError('Failed to search')
                  } finally {
                    setLoading(false)
                  }
                }
              }}
              className="w-full min-w-0 rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700"
              placeholder="Search emails (Enter)"
            />
            {search ? (
              <button
                className="text-xs text-neutral-400 hover:text-neutral-200"
                onClick={() => {
                  setSearch('')
                  // reload inbox on clear
                  ;(async () => {
                    try {
                      setLoading(true)
                      const resp = await fetch(`${API_BASE}/api/gmail/messages?limit=100`, { credentials: 'include' })
                      const json = await resp.json()
                      setEmails(json.messages || [])
                      setShowingSuggestions(false)
                      setSelectedForDelete(new Set())
                    } catch {
                      setError('Failed to load')
                    } finally {
                      setLoading(false)
                    }
                  })()
                }}
              >
                Clear
              </button>
            ) : null}
            {aiDeleteMode ? (
              <div className="flex items-center gap-1 ml-2">
                <button
                  className="size-8 grid place-items-center rounded-md border border-neutral-800 hover:bg-neutral-900"
                  title="Refresh AI suggestions"
                  aria-label="Refresh AI suggestions"
                  onClick={async () => {
                    try {
                      setLoading(true)
                      const url = buildApiUrl('/api/gmail/messages/suggest-deletions')
                      url.searchParams.set('limit', '200')
                      if (search.trim()) url.searchParams.set('q', search.trim())
                      const r = await fetch(url.toString(), { credentials: 'include' })
                      if (!r.ok) throw new Error('Failed')
                      const j = await r.json()
                      setEmails(j.messages || [])
                      setShowingSuggestions(true)
                      setSelectedForDelete(new Set())
                    } catch (e) {
                      setError('Failed to get suggestions')
                    } finally {
                      setLoading(false)
                    }
                  }}
                >
                  <Sparkles className="size-4 text-violet-300" />
                </button>
                <button
                  className="size-8 grid place-items-center rounded-md border border-neutral-800 hover:bg-neutral-900"
                  title="Select all shown"
                  aria-label="Select all shown"
                  onClick={() => setSelectedForDelete(new Set(shownIds))}
                >
                  <CheckSquare className="size-4" />
                </button>
                <button
                  disabled={selectedForDelete.size === 0}
                  className={`size-8 grid place-items-center rounded-md border ${selectedForDelete.size === 0 ? 'border-neutral-900 text-neutral-600' : 'border-red-700/40 text-red-300 hover:bg-red-600/10'}`}
                  title="Delete selected"
                  aria-label="Delete selected"
                  onClick={async () => {
                    if (selectedForDelete.size === 0) return
                    const ok = window.confirm(`Move ${selectedForDelete.size} selected email(s) to Trash?`)
                    if (!ok) return
                    try {
                      const ids = Array.from(selectedForDelete)
                      const r = await fetch(`${API_BASE}/api/gmail/messages/bulk-delete`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ids }),
                      })
                      if (!r.ok) throw new Error('Failed')
                      const j = await r.json()
                      const deleted = new Set<string>((j.deleted as string[]) || [])
                      setEmails((list) => list.filter((m) => !deleted.has(m.id)))
                      setSelectedForDelete(new Set())
                      if (selectedId && deleted.has(selectedId)) {
                        setDetail(null)
                        setSelectedId(null)
                      }
                      import('sonner').then(({ toast }) => toast.success(`Moved ${deleted.size} email(s) to Trash`))
                    } catch (e) {
                      import('sonner').then(({ toast }) => toast.error('Delete selected failed'))
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
                <button
                  className="size-8 grid place-items-center rounded-md border border-neutral-800 hover:bg-neutral-900"
                  title="Exit AI delete"
                  aria-label="Exit AI delete"
                  onClick={() => {
                    setAiDeleteMode(false)
                    setSelectedForDelete(new Set())
                    setShowingSuggestions(false)
                  }}
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : showingOtps ? (
              <div className="flex items-center gap-1 ml-2">
                <button
                  className="size-8 grid place-items-center rounded-md border border-neutral-800 hover:bg-neutral-900"
                  title="Refresh OTPs"
                  aria-label="Refresh OTPs"
                  onClick={async () => {
                    try {
                      setLoading(true)
                      const r = await fetch(`${API_BASE}/api/gmail/messages/otps?limit=300`, { credentials: 'include' })
                      if (!r.ok) throw new Error('Failed')
                      const j = await r.json()
                      setEmails(j.messages || [])
                      setSelectedForDelete(new Set())
                    } catch (e) {
                      setError('Failed to refresh OTPs')
                    } finally {
                      setLoading(false)
                    }
                  }}
                >
                  <Sparkles className="size-4 text-amber-300" />
                </button>
                <button
                  className="size-8 grid place-items-center rounded-md border border-neutral-800 hover:bg-neutral-900"
                  title="Select all shown"
                  aria-label="Select all shown"
                  onClick={() => setSelectedForDelete(new Set(shownIds))}
                >
                  <CheckSquare className="size-4" />
                </button>
                <button
                  disabled={selectedForDelete.size === 0}
                  className={`size-8 grid place-items-center rounded-md border ${selectedForDelete.size === 0 ? 'border-neutral-900 text-neutral-600' : 'border-red-700/40 text-red-300 hover:bg-red-600/10'}`}
                  title="Delete selected"
                  aria-label="Delete selected"
                  onClick={async () => {
                    if (selectedForDelete.size === 0) return
                    const ok = window.confirm(`Move ${selectedForDelete.size} selected OTP email(s) to Trash?`)
                    if (!ok) return
                    try {
                      const ids = Array.from(selectedForDelete)
                      const r = await fetch(`${API_BASE}/api/gmail/messages/bulk-delete`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ids }),
                      })
                      if (!r.ok) throw new Error('Failed')
                      const j = await r.json()
                      const deleted = new Set<string>((j.deleted as string[]) || [])
                      setEmails((list) => list.filter((m) => !deleted.has(m.id)))
                      setSelectedForDelete(new Set())
                      if (selectedId && deleted.has(selectedId)) {
                        setDetail(null)
                        setSelectedId(null)
                      }
                      import('sonner').then(({ toast }) => toast.success(`Moved ${deleted.size} OTP email(s) to Trash`))
                    } catch (e) {
                      import('sonner').then(({ toast }) => toast.error('Delete selected failed'))
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
                <button
                  className="size-8 grid place-items-center rounded-md border border-neutral-800 hover:bg-neutral-900"
                  title="Exit OTPs"
                  aria-label="Exit OTPs"
                  onClick={() => {
                    setShowingOtps(false)
                    setSelectedForDelete(new Set())
                  }}
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : null}
          </div>
          {loading ? (
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <ul className="divide-y divide-neutral-900 animate-pulse">
                {Array.from({ length: 10 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </ul>
            </div>
          ) : error ? (
            <div className="p-4 text-red-400">{error}</div>
          ) : (
            <div className="flex-1 overflow-auto">
              {/* Pinned section */}
              {pinnedItems.length > 0 ? (
                <div className="px-2">
                  <SectionHeader title={`Pinned [${pinnedItems.length}]`} />
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/40">
                    <ul className="divide-y divide-neutral-900">
                      {pinnedItems.map((m) => (
                        <EmailListRow
                          key={`p-${m.id}`}
                          m={m}
                          onClick={() => setSelectedId(m.id)}
                          selected={selectedId === m.id}
                          selectMode={aiDeleteMode}
                          selectedForDelete={selectedForDelete.has(m.id)}
                          onToggleSelect={() => toggleSelected(m.id)}
                        />
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}

              {/* Primary section or Category filter */}
              <div className="px-2 mt-4">
                <SectionHeader title={
                  showingOtps
                    ? 'OTPs'
                    : aiDeleteMode
                    ? showingSuggestions
                      ? 'AI suggested deletes'
                      : 'AI delete'
                    : selectedCategory
                    ? 'Category'
                    : 'Primary'
                } />
                <ul className="divide-y divide-neutral-900">
                  {primaryItems.map((m) => (
                    <EmailListRow
                      key={m.id}
                      m={m}
                      onClick={() => setSelectedId(m.id)}
                      selected={selectedId === m.id}
                      selectMode={aiDeleteMode}
                      selectedForDelete={selectedForDelete.has(m.id)}
                      onToggleSelect={() => toggleSelected(m.id)}
                    />
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>

        {/* Right detail */}
        <section className={`flex-1 flex flex-col ${selectedId ? '' : 'hidden'} md:flex`}>
          {composeOpen ? (
            <ComposeModal
              onClose={() => setComposeOpen(false)}
              onSend={async (payload) => {
                const r = await fetch(`${API_BASE}/api/gmail/messages/send`, {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                })
                if (!r.ok) {
                  import('sonner').then(({ toast }) => toast.error('Failed to send email'))
                } else {
                  setComposeOpen(false)
                }
              }}
            />
          ) : null}
          {!selectedId ? (
            <div className="m-auto text-neutral-500">Select an email to view</div>
          ) : detailLoading && !detail ? (
            <DetailSkeleton />
          ) : detail ? (
            <div className="flex-1 overflow-auto">
              <div className="border-b border-neutral-800 p-5 overflow-x-hidden">
                {/* Mobile back */}
                <div className="md:hidden mb-2">
                  <button
                    className="inline-flex items-center gap-2 text-neutral-300 hover:text-neutral-100"
                    onClick={() => setSelectedId(null)}
                  >
                    <ArrowLeft className="size-5" />
                    Back
                  </button>
                </div>
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      {detail.avatar ? (
                        <img src={detail.avatar} alt="avatar" className="size-9 rounded-full object-cover" />
                      ) : null}
                      <h1 className="text-xl md:text-2xl font-semibold text-neutral-100 leading-tight break-words">
                        {detail.subject || '(No subject)'}
                      </h1>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-neutral-400">
                      <div>
                        From: <span className="text-neutral-300">{detail.from}</span>
                      </div>
                      <div>
                        To: <span className="text-neutral-300">{detail.to}</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-full md:w-auto flex flex-row md:flex-col items-start md:items-end gap-2 shrink-0 text-xs text-neutral-400">
                    <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <IconButton
                      label={detail.isStarred ? 'Unpin' : 'Pin'}
                      active={!!detail.isStarred}
                      onClick={async () => {
                        const next = !detail.isStarred
                        setDetail((d) => (d ? { ...d, isStarred: next } : d))
                        setEmails((list) => list.map((it) => (it.id === detail.id ? { ...it, isStarred: next } : it)))
                        const resp = await fetch(`${API_BASE}/api/gmail/messages/${detail.id}/star`, {
                          method: 'POST',
                          credentials: 'include',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ star: next }),
                        })
                        if (!resp.ok) {
                          setDetail((d) => (d ? { ...d, isStarred: !next } : d))
                          setEmails((list) => list.map((it) => (it.id === detail.id ? { ...it, isStarred: !next } : it)))
                          import('sonner').then(({ toast }) => toast.error('Failed to update pin'))
                        }
                      }}
                    >
                      {detail.isStarred ? (
                        <Star className="size-4 fill-yellow-300 text-yellow-300" />
                      ) : (
                        <Star className="size-4" />
                      )}
                    </IconButton>
                    <IconButton
                      label="Reply"
                      onClick={() => {
                        const el = document.getElementById('reply-box') as HTMLTextAreaElement | null
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          setTimeout(() => el.focus(), 250)
                        }
                      }}
                    >
                      <LucideReply className="size-4" />
                    </IconButton>
                    <IconButton
                      label="Delete"
                      variant="danger"
                      onClick={async () => {
                        if (!confirm('Delete this email (move to trash)?')) return
                        const r = await fetch(`${API_BASE}/api/gmail/messages/${detail.id}`, {
                          method: 'DELETE',
                          credentials: 'include',
                        })
                        if (r.ok) {
                          setEmails((es) => es.filter((e) => e.id !== detail.id))
                          setDetail(null)
                          setSelectedId(null)
                          import('sonner').then(({ toast }) => toast.success('Moved to Trash'))
                        } else {
                          import('sonner').then(({ toast }) => toast.error('Failed to delete email'))
                        }
                      }}
                    >
                      <Trash2 className="size-5" />
                    </IconButton>
                    </div>
                      {/* Add to category menu */}
                      <div className="relative">
                        <button
                          className="size-9 grid place-items-center rounded-md border border-neutral-800 hover:bg-neutral-900"
                          title="Add to category"
                          aria-label="Add to category"
                          onClick={() => setShowCategoryMenu((v) => !v)}
                        >
                          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </button>
                        {showCategoryMenu ? (
                          <div className="absolute right-0 mt-1 w-56 rounded-md border border-neutral-800 bg-neutral-950 shadow-lg z-10">
                            <div className="max-h-64 overflow-auto py-1">
                              {categories.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-neutral-500">No categories yet</div>
                              ) : (
                                categories.map((c) => (
                                  <button
                                    key={c._id}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-900"
                                    onClick={async () => {
                                      setShowCategoryMenu(false)
                                      await addToCategory(c._id, detail.id)
                                    }}
                                  >
                                    {c.name}
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-xs text-neutral-500">{new Date(detail.date).toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* Summary Section with inline action */}
              <SummaryCard
                title="AI Summary"
                text={detail.summary || ''}
                importance={detail.importance}
                expanded={summaryExpanded}
                onToggle={() => setSummaryExpanded((v) => !v)}
                actionLabel={summarizing ? 'Summarizing…' : detail.summary ? 'Regenerate' : 'Summarize'}
                actionDisabled={summarizing}
                onAction={async () => {
                  try {
                    setSummarizing(true)
                    const sum = await fetch(`${API_BASE}/api/gmail/messages/${detail.id}/summarize`, {
                      method: 'POST',
                      credentials: 'include',
                    })
                    if (sum.ok) {
                      const sjson = await sum.json()
                      setDetail((prev) => (prev ? { ...prev, summary: sjson.summary, importance: sjson.importance } : prev))
                    }
                  } catch (e) {
                    import('sonner').then(({ toast }) => toast.error('Failed to summarize'))
                  } finally {
                    setSummarizing(false)
                  }
                }}
              />

              {/* Thread (conversation) */}
          <div className="px-4 pb-8 space-y-8 overflow-x-hidden max-w-full">
                {threadMessages.map((m, idx) => (
                  <div key={m.id} className="group">
                    <div className="mb-2 text-xs text-neutral-500">
                      {m.from} • {new Date(m.date).toLocaleString()}
                    </div>
                    {m.bodyHtml ? (
                      <EmailHtmlFrame html={sanitizeHtmlForDark(m.bodyHtml)} />
                    ) : (
                      <pre className="whitespace-pre-wrap text-sm text-neutral-200">{m.bodyText}</pre>
                    )}
                    {/* Divider between messages except after last */}
                    {idx < threadMessages.length - 1 ? (
                      <div className="mt-6 border-b border-neutral-900" />
                    ) : null}
                    {/* Add to category action */}
                    {selectedId && selectedCategory ? (
                      <div className="mt-2">
                        <button
                          className="rounded-md border border-neutral-800 px-2 py-1 text-xs hover:bg-neutral-900"
                          onClick={async () => {
                            try {
                              await fetch(`${API_BASE}/api/gmail/categories/${selectedCategory}/mails`, {
                                method: 'POST',
                                credentials: 'include',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ messageId: detail?.id }),
                              })
                              import('sonner').then(({ toast }) => toast.success('Added to category'))
                            } catch {
                             import('sonner').then(({ toast }) => toast.error('Failed to add to category'))
                            }
                          }}
                        >
                          Add this email to selected category
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}

                {/* Minimalist reply composer */}
                <ReplyBox
                  onSuggest={async () => {
                    try {
                      const r = await fetch(`${API_BASE}/api/gmail/messages/${detail.id}/suggest-reply`, {
                        method: 'POST',
                        credentials: 'include',
                      })
                      const contentType = r.headers.get('content-type') || ''
                      if (!r.ok) {
                        const txt = await r.text().catch(() => '')
                        console.error('Suggest reply error', r.status, txt)
                        return ''
                      }
                      if (contentType.includes('application/json')) {
                        const j = await r.json()
                        if (j && typeof j.reply === 'string') return j.reply as string
                        return ''
                      }
                      const txt = await r.text()
                      try {
                        const j = JSON.parse(txt)
                        return typeof j.reply === 'string' ? j.reply : ''
                      } catch {
                        return txt.slice(0, 1200)
                      }
                    } catch (e) {
                      console.error(e)
                      return ''
                    }
                  }}
                  onSend={async (text) => {
                    const r = await fetch(`${API_BASE}/api/gmail/messages/${detail.id}/reply`, {
                      method: 'POST',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ body: text }),
                    })
                    if (!r.ok) {
                      import('sonner').then(({ toast }) => toast.error('Failed to send reply'))
                    } else {
                      // Refresh thread so the new reply appears under the original
                      try {
                        const t = await fetch(`${API_BASE}/api/gmail/messages/${detail.id}/thread`, {
                          credentials: 'include',
                        })
                        if (t.ok) {
                          const tj = await t.json()
                          if (Array.isArray(tj.messages)) setThreadMessages(tj.messages)
                        }
                      } catch {}
                    }
                  }}
                />
              </div>
            </div>
          ) : null}
        </section>
      </div>
      {/* Global modals to ensure they open on mobile */}
      {coldOpen ? (
        <ComposeColdEmailModal
          onClose={() => setColdOpen(false)}
          onGenerate={async (payload: { to: string; keywords: string; role?: string; company?: string }) => {
            const r = await fetch(`${API_BASE}/api/cold-email/generate`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
            if (!r.ok) throw new Error('Failed to generate')
            return (await r.json()) as { to: string; subject: string; body: string; reason?: string }
          }}
          onSend={async (payload: { to: string; subject: string; body: string }) => {
            const r = await fetch(`${API_BASE}/api/cold-email/send`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
            if (!r.ok) throw new Error('Failed to send')
            return true
          }}
        />
      ) : null}
      {chatModalOpen ? (
        <ChatModal
          onClose={() => setChatModalOpen(false)}
          suggestions={chatSuggestions}
          history={chatHistory}
          pendingSend={chatPendingSend}
          onCancelPendingSend={() => setChatPendingSend(null)}
          onConfirmSend={async ({ to, subject, body }) => {
            const sr = await fetch(`${API_BASE}/api/gmail/messages/send`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ to, subject, body }),
            })
            if (sr.ok) {
              setChatHistory((h) => [...h, { role: 'assistant', text: `Email sent to ${to}` }])
              setChatPendingSend(null)
              try {
                const resp = await fetch(`${API_BASE}/api/gmail/messages?limit=100`, { credentials: 'include' })
                if (resp.ok) {
                  const json = await resp.json()
                  setEmails(json.messages || [])
                }
              } catch {}
              return true
            }
            setChatHistory((h) => [...h, { role: 'assistant', text: 'Failed to send email.' }])
            return false
          }}
          onAsk={async (q) => {
            setChatHistory((h) => [...h, { role: 'user', text: q }])
            try {
              const r = await fetch(`${API_BASE}/api/chat/ask`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: q }),
              })
              const contentType = r.headers.get('content-type') || ''
              if (!r.ok) {
                await r.text().catch(() => '')
                setChatHistory((h) => [...h, { role: 'assistant', text: 'Sorry, I could not answer.' }])
              } else if (contentType.includes('application/json')) {
                const j = await r.json()
                const a = j?.answer || 'No answer'
                setChatHistory((h) => [...h, { role: 'assistant', text: a }])

                if (j?.action === 'send' && j?.send?.toEmail) {
                  const subject = j.send.subject || 'Quick note'
                  const body = j.send.body || a
                  setChatPendingSend({ toEmail: j.send.toEmail, subject, body })
                } else if (j?.action === 'schedule' && (j?.schedule?.when || j?.schedule?.timezone)) {
                  const ok = window.confirm('Schedule this email as suggested?')
                  if (ok) {
                    const tz = j.schedule.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
                    const to = j.schedule.toEmail
                    const subject = j.schedule.subject || 'Scheduled note'
                    const body = j.schedule.body || a
                    const prompt = `Send at ${j.schedule.when || 'next available time'} to ${to}`
                    const sr = await fetch(`${API_BASE}/api/schedule/schedule`, {
                      method: 'POST',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ to, subject, body, prompt, timezone: tz }),
                    })
                    if (sr.ok) {
                      setChatHistory((h) => [...h, { role: 'assistant', text: 'Scheduled the email.' }])
                    } else {
                      setChatHistory((h) => [...h, { role: 'assistant', text: 'Failed to schedule.' }])
                    }
                  }
                }
              } else {
                const txt2 = await r.text()
                setChatHistory((h) => [...h, { role: 'assistant', text: txt2.slice(0, 400) }])
              }
            } catch (e) {
              setChatHistory((h) => [...h, { role: 'assistant', text: 'Network error.' }])
            } finally {
            }
          }}
        />
      ) : null}
    </div>
  )
}

function ProfileHeader({ profile }: { profile: { name?: string; email?: string; picture?: string } | null }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative px-2 pt-1">
      <button
        className="w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral-900"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          {profile?.picture ? (
            <img src={profile.picture} alt="avatar" className="size-6 rounded-full object-cover" />
          ) : (
            <div className="size-6 rounded bg-blue-500/80 text-white grid place-items-center font-bold">
              {getInitial(profile?.name || profile?.email || 'U')}
            </div>
          )}
          <div className="text-left">
            <div className="text-sm font-semibold">{profile?.name || 'Signed in'}</div>
            <div className="text-xs text-neutral-400">{profile?.email || ''}</div>
          </div>
        </div>
        <svg className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.25a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clipRule="evenodd"/></svg>
      </button>
      {open ? (
        <div className="absolute left-2 right-2 mt-1 rounded-lg border border-neutral-800 bg-neutral-950 shadow-lg z-10">
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-900"
            onClick={async () => {
              try {
                await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' })
              } catch {}
              window.location.href = '/'
            }}
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      ) : null}
    </div>
  )
}

function Avatar({ from, unread }: { from: string; unread?: boolean }) {
  const letter = String(from || '?')
    .replace(/".*?"/g, '')
    .trim()
    .charAt(0)
    .toUpperCase()
  return (
    <div className="relative">
      <div className="size-7 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-semibold">{letter}</div>
      {unread ? <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-blue-500 ring-2 ring-neutral-950" /> : null}
    </div>
  )
}

function getInitial(nameOrEmail: string): string {
  const s = String(nameOrEmail || '').trim()
  if (!s) return 'U'
  const letter = s.match(/[A-Za-z]/)?.[0]
  return (letter || s[0]).toUpperCase()
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-3 py-2 text-xs uppercase tracking-wide text-neutral-500 select-none">{title}</div>
  )
}

function EmailListRow({
  m,
  onClick,
  selected,
  selectMode,
  selectedForDelete,
  onToggleSelect,
}: {
  m: EmailListItem & { isStarred?: boolean }
  onClick: () => void
  selected: boolean
  selectMode?: boolean
  selectedForDelete?: boolean
  onToggleSelect?: () => void
}) {
  return (
    <li
      onClick={onClick}
      className={`cursor-pointer p-3 hover:bg-neutral-900 active:bg-neutral-900 focus:outline-none ${selected ? 'bg-neutral-900' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {selectMode ? (
            <input
              type="checkbox"
              className="size-4 accent-red-500"
              onClick={(e) => e.stopPropagation()}
              onChange={onToggleSelect}
              checked={!!selectedForDelete}
            />
          ) : null}
          <Avatar from={m.from} unread={m.unread} />
          <div className={`line-clamp-1 ${m.unread ? 'font-semibold' : 'font-medium'} text-neutral-200 transition-none select-none pointer-events-none`}>
            {m.subject || '(No subject)'}
          </div>
        </div>
        <div className="text-xs text-neutral-500 transition-none select-none pointer-events-none">{new Date(m.date).toLocaleDateString()}</div>
      </div>
      <div className="text-xs text-neutral-400 line-clamp-1 transition-none select-none pointer-events-none">{m.from}</div>
      <div className="text-sm text-neutral-300 line-clamp-2 mt-1 transition-none select-none pointer-events-none">{m.snippet}</div>
    </li>
  )
}

function CategoryManager({
  categories,
  onAdd,
  onRemove,
  onSelect,
}: {
  categories: Array<{ _id: string; name: string }>
  onAdd: (name: string) => Promise<void> | void
  onRemove: (id: string) => Promise<void> | void
  onSelect: (id: string | null) => void
}) {
  const [newName, setNewName] = useState('')
  return (
    <div className="px-0 overflow-x-hidden">
      <div>
        <div className="divide-y divide-neutral-800">
          {categories.map((c) => (
            <div key={c._id} className="flex items-center justify-between py-2 text-sm hover:bg-neutral-900/30 transition-colors">
              <button className="text-left flex-1 min-w-0 truncate" onClick={() => onSelect(c._id)}>
                {c.name}
              </button>
              <button className="size-6 shrink-0 grid place-items-center text-neutral-400 hover:text-red-400" onClick={() => onRemove(c._id)} aria-label="Remove">
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="w-full flex items-center gap-2 pt-2 pr-1">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Add category"
            className="flex-1 min-w-0 rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-neutral-700"
          />
          <button
            className="size-8 shrink-0 grid place-items-center rounded-md border border-neutral-800 hover:bg-neutral-900"
            onClick={async () => {
              const name = newName.trim()
              if (!name) return
              await onAdd(name)
              setNewName('')
            }}
            title="Add"
            aria-label="Add"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function SidebarContent({
  profile,
  leftItems,
  onCompose,
  onLeftItemClick,
  onShowOtps,
  onShowAiDelete,
  categories,
  onAddCategory,
  onRemoveCategory,
  onSelectCategory,
  onOpenChat,
  onOpenCold,
}: {
  profile: { name?: string; email?: string; picture?: string } | null
  leftItems: Array<{ key: string; label: string; count: number; Icon: React.ComponentType<{ className?: string }> }>
  onCompose: () => void
  onLeftItemClick: (key: string) => void
  onShowOtps: () => void
  onShowAiDelete: () => void
  categories: Array<{ _id: string; name: string }>
  onAddCategory: (name: string) => Promise<void> | void
  onRemoveCategory: (id: string) => Promise<void> | void
  onSelectCategory: (id: string | null) => void
  onOpenChat: () => void
  onOpenCold: () => void
}) {
  return (
    <div className="h-full flex flex-col">
      <ProfileHeader profile={profile} />
      <div className="flex-1 flex flex-col px-4">
        <div className="pt-2 pb-2">
          <button
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 text-sm"
            onClick={onCompose}
          >
            <Send className="size-4" /> New email
          </button>
        </div>
        <div className="pb-2 text-[11px] uppercase tracking-wide text-neutral-500">Core</div>
        <nav className="flex flex-col pb-2 divide-y divide-neutral-800">
          {leftItems.map(({ key, label, Icon }) => (
            <button
              key={key}
              className="group flex items-center justify-between py-2 text-left hover:bg-neutral-900/30 transition-colors"
              onClick={() => onLeftItemClick(key)}
            >
              <span className="inline-flex items-center gap-3 text-sm text-neutral-200">
                <Icon className="size-4 text-white" />
                <span className="group-hover:text-neutral-100">{label}</span>
              </span>
              <span className="text-[11px] text-neutral-500" />
            </button>
          ))}
        </nav>
        <div className="pt-4 pb-1 text-[11px] uppercase tracking-wide text-neutral-500">Invoxus Lens</div>
        <div className="divide-y divide-neutral-800">
          <button
            className="group w-full inline-flex items-center justify-between py-2 text-sm hover:bg-neutral-900/30 transition-colors"
            onClick={onShowOtps}
          >
            <span className="inline-flex items-center gap-3">
              <KeyRound className="size-4 text-white" />
              <span>OTPs</span>
            </span>
            <span className="text-[11px] text-neutral-500" />
          </button>
          <button
            className="group w-full inline-flex items-center justify-between py-2 text-sm hover:bg-neutral-900/30 transition-colors"
            onClick={onShowAiDelete}
          >
            <span className="inline-flex items-center gap-3">
              <Trash2 className="size-4 text-white" />
              <span>AI delete</span>
            </span>
            <span className="text-[11px] text-neutral-500">AI</span>
          </button>
        </div>
        <div className="pt-5 text-[11px] uppercase tracking-wide text-neutral-500">Categories</div>
        <CategoryManager
        categories={categories}
        onAdd={onAddCategory}
        onRemove={onRemoveCategory}
        onSelect={onSelectCategory}
        />
      </div>
      <div className="mt-auto pt-2 px-4">
        <div className="border-t border-neutral-800/60" />
        <div className="pt-2 pb-1">
          <button
            className="group w-full inline-flex items-center justify-between py-2 text-sm hover:bg-neutral-900/30 transition-colors"
            onClick={onOpenChat}
            title="Open assistant"
          >
            <span className="inline-flex items-center gap-2">
              <MessageSquare className="size-4 text-white" />
              <span>Ask Invoxus</span>
            </span>
            <span className="text-[11px] text-neutral-500">Ctrl+/</span>
          </button>
        </div>
        <div className="pb-2">
          <button
            className="group w-full inline-flex items-center justify-between py-2 text-sm hover:bg-neutral-900/30 transition-colors"
            onClick={onOpenCold}
            title="Open cold email"
          >
            <span className="inline-flex items-center gap-2">
              <Wand2 className="size-4 text-white" />
              <span>Cold email</span>
            </span>
            <span className="text-[11px] text-neutral-500">AI</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function ChatModal({
  onClose,
  suggestions,
  history,
  pendingSend,
  onCancelPendingSend,
  onConfirmSend,
  onAsk,
}: {
  onClose: () => void
  suggestions: string[]
  history: Array<{ role: 'user' | 'assistant'; text: string }>
  pendingSend: null | { toEmail: string; subject: string; body: string }
  onCancelPendingSend: () => void
  onConfirmSend: (p: { to: string; subject: string; body: string }) => Promise<boolean>
  onAsk: (q: string) => Promise<void>
}) {
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
    // When assistant responds (last message role = assistant), show feedback prompt
    if (history.length > 0) {
      const last = history[history.length - 1]
      if (last.role === 'assistant') {
        setShowFeedback(Date.now())
      }
    }
  }, [history])
  return (
    <div className="fixed inset-0 md:inset-auto md:right-6 md:bottom-6 z-50 flex md:block">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm md:hidden" onClick={onClose} />
      <div className="relative w-full h-full md:h-auto md:w-[460px] md:max-w-[92vw] rounded-none md:rounded-2xl border border-neutral-800/80 bg-neutral-950/95 shadow-2xl overflow-hidden flex flex-col ml-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-gradient-to-b from-neutral-950/90 to-neutral-900/50">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-200 tracking-wide">
            <Bot className="size-4 text-blue-400" />
            Invoxus Assistant
          </div>
          <button className="size-8 grid place-items-center rounded hover:bg-neutral-900" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>
        <div className="p-4 flex flex-col gap-3 flex-1 md:h-[60vh]">
          {pendingSend ? (
            <PendingSendForm
              draft={pendingSend}
              onCancel={onCancelPendingSend}
              onConfirm={onConfirmSend}
            />
          ) : showExamples ? (
            <>
              <div className="grid place-items-center py-4">
                <div className="size-12 grid place-items-center rounded-xl border border-neutral-800 bg-neutral-900 text-blue-300">
                  <Bot className="size-5" />
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-neutral-200">Ask anything about your emails</div>
                <div className="text-xs text-neutral-500 mt-1">Use natural language to search, summarize and act</div>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full border border-neutral-800 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-900"
                    onClick={() => setValue(s)}
                  >
                    <Sparkles className="size-3 text-yellow-300" /> {s}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {/* Messages */}
          <div ref={messagesRef} className="mt-1 space-y-2 flex-1 overflow-y-auto pr-1 no-scrollbar">
            {history.slice(-12).map((m, idx) => (
              <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm border shadow-sm ${
                    m.role === 'user'
                      ? 'bg-blue-600/15 border-blue-700/40 text-neutral-100'
                      : 'bg-neutral-900/60 border-neutral-800 text-neutral-200'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {sending ? (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl px-3 py-2 text-xs border border-neutral-800 text-neutral-400 bg-neutral-950">
                  Thinking…
                </div>
              </div>
            ) : null}
          </div>

          {/* Feedback (minimal) */}
          {showFeedback ? (
            <div className="flex items-center justify-end gap-2 pb-1 -mt-1">
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-800 hover:bg-neutral-900"
                title="Good answer"
                aria-label="Thumbs up"
                onClick={() => {
                  setShowFeedback(null)
                  // fire-and-forget feedback endpoint if available
                  fetch('/api/chat/feedback', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vote: 'up' }) }).catch(() => {})
                }}
              >
                <ThumbsUp className="size-4" />
              </button>
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-800 hover:bg-neutral-900"
                title="Needs work"
                aria-label="Thumbs down"
                onClick={() => {
                  setShowFeedback(null)
                  fetch('/api/chat/feedback', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vote: 'down' }) }).catch(() => {})
                }}
              >
                <ThumbsDown className="size-4" />
              </button>
            </div>
          ) : null}

          {/* Input */}
          <div className="flex items-center gap-2 pt-2">
            <div className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900/40 p-1">
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
            {/* Voice button omitted for now */}
            <button
              disabled={!value.trim() || sending}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
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
  )
}

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

function SkeletonRow() {
  return (
    <li className="p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-full bg-neutral-900" />
          <div className="h-4 w-48 rounded bg-neutral-900" />
        </div>
        <div className="h-3 w-14 rounded bg-neutral-900" />
      </div>
      <div className="mt-2 h-3 w-56 rounded bg-neutral-900" />
      <div className="mt-2 h-3 w-80 rounded bg-neutral-900" />
    </li>
  )
}

function DetailSkeleton() {
  return (
    <div className="flex-1 overflow-auto">
      <div className="border-b border-neutral-800 p-4">
        <div className="h-5 w-72 rounded bg-neutral-900 animate-pulse" />
        <div className="mt-2 h-3 w-40 rounded bg-neutral-900 animate-pulse" />
      </div>
      <div className="m-4 rounded-xl border border-neutral-800 p-4">
        <div className="h-4 w-24 rounded bg-neutral-900 animate-pulse" />
        <div className="mt-3 space-y-2">
          <div className="h-3 w-full rounded bg-neutral-900 animate-pulse" />
          <div className="h-3 w-5/6 rounded bg-neutral-900 animate-pulse" />
          <div className="h-3 w-4/6 rounded bg-neutral-900 animate-pulse" />
        </div>
      </div>
      <div className="px-4 pb-8 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-32 rounded bg-neutral-900 animate-pulse" />
            <div className="h-3 w-full rounded bg-neutral-900 animate-pulse" />
            <div className="h-3 w-5/6 rounded bg-neutral-900 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}

function ComposeModal({
  onClose,
  onSend,
}: {
  onClose: () => void
  onSend: (payload: { to: string; cc?: string; bcc?: string; subject: string; body: string }) => Promise<void>
}) {
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  return (
    <div className="absolute inset-0 z-20 flex items-start justify-center bg-black/40 backdrop-blur-sm">
      <div className="mt-10 w-full max-w-2xl rounded-xl border border-neutral-800 bg-neutral-950">
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <div className="text-sm text-neutral-300">New message</div>
          <button className="size-8 grid place-items-center rounded-md hover:bg-neutral-900" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs text-neutral-500">To</label>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="flex-1 rounded-md bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700"
            />
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
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-neutral-800 px-4 py-3">
          <button className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-900" onClick={onClose}>
            Cancel
          </button>
          <button
            disabled={sending || !to.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-1.5 text-sm"
            onClick={async () => {
              try {
                setSending(true)
                await onSend({ to, cc: cc || undefined, bcc: bcc || undefined, subject, body })
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

function IconButton({
  label,
  children,
  onClick,
  active,
  variant,
}: {
  label: string
  children: React.ReactNode
  onClick?: () => void
  active?: boolean
  variant?: 'default' | 'danger' | 'ghost'
}) {
  const base = 'inline-flex items-center justify-center size-8 rounded-md border'
  const theme =
    variant === 'danger'
      ? 'border-red-700/40 text-red-300 hover:bg-red-600/10'
      : variant === 'ghost'
      ? 'border-transparent text-neutral-300 hover:bg-neutral-900'
      : active
      ? 'border-yellow-600/40 text-yellow-300 bg-yellow-500/10'
      : 'border-neutral-700 text-neutral-300 hover:bg-neutral-800'
  return (
    <button className={`${base} ${theme}`} title={label} aria-label={label} onClick={onClick}>
      {children}
    </button>
  )
}

// Replaced custom icons with lucide-react icons above.

function ImportanceBadge({ level }: { level: Importance }) {
  const color =
    level === 'high' ? 'bg-amber-500/20 text-amber-300 border-amber-600/40' : level === 'medium' ? 'bg-neutral-800 text-neutral-300 border-neutral-700' : 'bg-neutral-900 text-neutral-400 border-neutral-800'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${color}`}>
      {level.toUpperCase()}
    </span>
  )
}

function sanitizeHtmlForDark(html: string): string {
  try {
    // Inject minimal CSS to force dark-friendly colors without heavy sanitization libs.
    const style = `<style>
      /* Scope styles to only the email rendering container */
      .email-frame, .email-frame * { box-sizing: border-box !important; }
      .email-frame, .email-frame * { color: rgba(235,235,245,0.92) !important; }
      .email-frame { max-width: 100% !important; overflow-x: hidden !important; background: transparent !important; background-color: transparent !important; }
      .email-frame a { color: #8ab4f8 !important; }
      .email-frame a:visited { color: #b293f0 !important; }
      .email-frame hr { border-color: rgba(255,255,255,0.12) !important; }
      .email-frame blockquote { border-left: 3px solid rgba(255,255,255,0.18) !important; }
      .email-frame img, .email-frame video, .email-frame canvas, .email-frame svg { max-width: 100% !important; height: auto !important; }
      .email-frame iframe { max-width: 100% !important; width: 100% !important; }
      .email-frame table { width: 100% !important; table-layout: fixed !important; color: rgba(235,235,245,0.92) !important; background: transparent !important; }
      .email-frame td, .email-frame th { word-break: break-word !important; }
      .email-frame pre { white-space: pre-wrap !important; word-break: break-word !important; background: rgba(255,255,255,0.06) !important; }
      .email-frame code { word-break: break-word !important; background: rgba(255,255,255,0.06) !important; }
      .email-frame p, .email-frame div, .email-frame a, .email-frame li, .email-frame td, .email-frame th { word-break: break-word !important; overflow-wrap: anywhere !important; background: transparent !important; background-color: transparent !important; }
      .email-frame mark { background: rgba(255, 246, 0, 0.25) !important; color: rgba(235,235,245,0.92) !important; }
    </style>`
    // Place style tag at the top; if HTML already has <head>, insert inside it.
    if (/<head[\s\S]*?>/i.test(html)) {
      return html.replace(/<head(\s*?)>/i, (m) => `${m}${style}`)
    }
    return `${style}${html}`
  } catch {
    return html
  }
}

function EmailHtmlFrame({ html }: { html: string }) {
  // Encapsulate email HTML in its own container with reset styles so it doesn't affect app fonts
  return (
    <div className="email-frame max-w-none overflow-x-hidden">
      <div
        className="prose prose-invert max-w-none break-words [&_*]:!text-[inherit] [&_*]:!leading-relaxed [&_h1]:!text-[1.125rem] [&_h2]:!text-[1.0625rem] [&_h3]:!text-[1rem] [&_p]:!text-[0.9375rem] [&_a]:!no-underline [&_a]:!text-blue-400 [&_a]:break-words [&_img]:max-w-full [&_img]:h-auto [&_pre]:whitespace-pre-wrap [&_code]:break-words [&_table]:w-full [&_table]:table-fixed [&_td]:break-words [&_th]:break-words [&_iframe]:max-w-full [&_iframe]:w-full [&_blockquote]:break-words"
        style={{ fontSize: 'inherit', lineHeight: 'inherit' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

function ReplyBox({ onSend, onSuggest }: { onSend: (text: string) => Promise<void>; onSuggest?: () => Promise<string> }) {
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  return (
    <div className="mt-6 border-t border-neutral-800 pt-3">
      <textarea
        id="reply-box"
        className="w-full resize-y bg-transparent border-0 px-0 py-2 text-sm outline-none placeholder:text-neutral-500 min-h-[60px]"
        placeholder="Write a reply…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="mt-1 flex items-center gap-2">
        {onSuggest ? (
          <IconButton
            label="Suggest with AI"
            variant="ghost"
            onClick={async () => {
              const suggestion = (await onSuggest()) || ''
              if (suggestion) setValue(suggestion)
            }}
          >
            <Wand2 className="size-4" />
          </IconButton>
        ) : null}
        <IconButton
          label={sending ? 'Sending…' : 'Send reply'}
          variant="ghost"
          onClick={async () => {
            if (!value.trim() || sending) return
            try {
              setSending(true)
              await onSend(value)
              setValue('')
            } finally {
              setSending(false)
            }
          }}
        >
          <Send className="size-4" />
        </IconButton>
      </div>
    </div>
  )
}

function ComposeColdEmailModal({
  onClose,
  onGenerate,
  onSend,
}: {
  onClose: () => void
  onGenerate: (p: { to: string; keywords: string; role?: string; company?: string }) => Promise<{ to: string; subject: string; body: string; reason?: string }>
  onSend: (p: { to: string; subject: string; body: string }) => Promise<boolean>
}) {
  const [to, setTo] = useState('')
  const [role, setRole] = useState('HR')
  const [company, setCompany] = useState('')
  const [keywords, setKeywords] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)

  const toInvalid = !!to && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)
  const wordCount = body ? body.trim().split(/\s+/).filter(Boolean).length : 0
  const previewReady = !!subject || !!body
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-stretch md:items-start justify-center">
      <div className="mt-0 md:mt-10 w-full md:w-auto h-full md:h-auto md:max-w-3xl max-w-[100vw] rounded-none md:rounded-2xl border border-neutral-800 bg-neutral-950 shadow-xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-violet-400" />
            <div>
              <div className="text-sm font-medium text-neutral-200">Cold email</div>
              <div className="text-xs text-neutral-500">Generate a concise, personalized outreach</div>
            </div>
          </div>
          <button className="size-8 grid place-items-center rounded hover:bg-neutral-900" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto md:max-h-[72vh] no-scrollbar flex-1" aria-busy={loading}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-neutral-500 mb-1">To</label>
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className={`w-full rounded-md bg-neutral-900 border px-3 py-2 text-sm outline-none focus:ring-1 ${toInvalid ? 'border-red-500/60 focus:ring-red-600/40' : 'border-neutral-800 focus:ring-neutral-700'}`}
                  placeholder="hr@example.com"
                />
                {toInvalid ? <div className="mt-1 text-[11px] text-red-400">Enter a valid email</div> : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">Role</label>
                  <input value={role} onChange={(e) => setRole(e.target.value)} className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700" placeholder="HR" />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">Company</label>
                  <input value={company} onChange={(e) => setCompany(e.target.value)} className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700" placeholder="Acme Inc." />
                </div>
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Keywords</label>
                <textarea value={keywords} onChange={(e) => setKeywords(e.target.value)} className="min-h-[88px] w-full resize-y rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700" placeholder="e.g. frontend developer, react, portfolio, experience" />
              </div>
              {error ? <div className="text-xs text-red-400">{error}</div> : null}
              <div className="flex items-center gap-2 pt-1">
                <button
                  disabled={loading || !to.trim() || toInvalid}
                  className="inline-flex items-center gap-2 rounded-md border border-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-900 disabled:opacity-50"
                  onClick={async () => {
                    try {
                      setLoading(true)
                      setError(null)
                      const d = await onGenerate({ to, keywords, role, company })
                      if (d.to && !to) setTo(d.to)
                      const nextSubject = d.subject || subject || ''
                      const nextBody = d.body || body || ''
                      setSubject(nextSubject)
                      setBody(nextBody)
                      setReason(d.reason || null)
                      // notify
                      import('sonner').then(({ toast }) => toast.success('Draft generated'))
                      // scroll preview into view on mobile
                      setTimeout(() => {
                        previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }, 50)
                    } finally {
                      setLoading(false)
                    }
                  }}
                >
                  <Wand2 className="size-4" />
                  {loading ? 'Generating…' : previewReady ? 'Regenerate' : 'Generate draft'}
                </button>
                <div className="text-xs text-neutral-500">AI creates a short, tailored draft.</div>
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Subject</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-neutral-500">Body</label>
                  <span className={`text-[11px] ${wordCount > 160 ? 'text-amber-400' : 'text-neutral-500'}`}>{wordCount} words</span>
                </div>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[160px] w-full resize-y rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700" />
              </div>
            </div>
            <div ref={previewRef} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 self-start w-full">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-neutral-400">Preview</div>
                {reason ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-900/30 text-violet-300 border border-violet-700/40">{reason}</span> : null}
              </div>
              {previewReady ? (
                <div className="space-y-3">
                  <div className="text-sm text-neutral-200 font-medium">{subject || 'No subject'}</div>
                  <div className="h-px bg-neutral-800" />
                  <div className="text-sm text-neutral-300 whitespace-pre-wrap leading-6">{body || 'No body yet.'}</div>
                </div>
              ) : (
                <div className="text-xs text-neutral-500">Generate a draft to see a live preview here.</div>
              )}
            </div>
          </div>

              <div className="flex items-center justify-end gap-2 pt-5">
            <button className="rounded-md border border-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-900" onClick={onClose}>Close</button>
            <button
              disabled={!to.trim() || toInvalid || !subject.trim() || !body.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-1.5 text-sm"
              onClick={async () => {
                try {
                  setLoading(true)
                      const ok = await onSend({ to, subject, body })
                  if (ok) onClose()
                } catch (e: any) {
                  setError('Failed to send email')
                } finally {
                  setLoading(false)
                }
              }}
            >
              <Send className="size-4" />
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
  title,
  text,
  importance,
  expanded,
  onToggle,
  actionLabel,
  actionDisabled,
  onAction,
}: {
  title: string
  text: string
  importance?: Importance
  expanded: boolean
  onToggle: () => void
  actionLabel?: string
  actionDisabled?: boolean
  onAction?: () => void
}) {
  return (
    <div className="m-4 rounded-xl border border-violet-700/60 bg-neutral-950/80 shadow-[0_0_48px_rgba(76,29,149,0.55)] ring-1 ring-violet-900/50">
      <div className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <button className="flex items-center gap-2 text-left min-w-0" onClick={onToggle}>
          <span className="text-sm text-neutral-300">{title}</span>
          <span className={`transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`}>▾</span>
        </button>
        {onAction ? (
          <button
            className="rounded-md bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-3 py-1.5 text-xs shrink-0"
            disabled={actionDisabled}
            onClick={onAction}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
      {expanded ? (
        <div className="px-4 pb-4 break-words">
          {text ? (
            <div className="text-[15px] leading-7 text-neutral-200">{text}</div>
          ) : (
            <div className="text-xs text-neutral-500">No summary yet.</div>
          )}
          {importance ? (
            <div className="mt-2">
              <ImportanceBadge level={importance} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}



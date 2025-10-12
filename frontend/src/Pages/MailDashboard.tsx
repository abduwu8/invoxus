import { useEffect, useMemo, useRef, useState } from 'react'
import { Star, Reply as LucideReply, Trash2, Wand2, Send, X, Plus, Inbox, MessageSquare, Sparkles, CheckSquare, KeyRound, LogOut, Menu, ArrowLeft, ThumbsUp, ThumbsDown, Paperclip, Check, RefreshCw, Loader2, AlertCircle, FileText, Search, Mail } from 'lucide-react'
import { PlaceholdersAndVanishInput } from '../components/ui/reveal'
import { LoaderOne } from '../components/loader'
import PaymentComponent from '../components/PaymentComponent'
import { NewFeatureModal } from '../components/mail/modals/NewFeatureModal'
// Emoji picker removed for now
// Note: Components like ChatModal, ComposeModal, etc. are defined inline below for now
// TODO: Complete refactoring to extract all components to separate files

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

type UserProfile = { name?: string; email?: string; picture?: string; provider?: 'google' | 'microsoft' }

export default function MailDashboard() {
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
  
  // Helper function to get the correct API endpoint based on provider
  const getApiPath = (path: string) => {
    const provider = profile?.provider || 'google'
    const apiPrefix = provider === 'microsoft' ? '/api/outlook' : '/api/gmail'
    const fullPath = `${apiPrefix}${path}`
    console.log('[DEBUG] getApiPath:', { provider, path, fullPath })
    return fullPath
  }
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
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string; emails?: any[] }>>([])
  const [chatModalOpen, setChatModalOpen] = useState(false)
  const [chatPendingSend, setChatPendingSend] = useState<null | { toEmail: string; subject: string; body: string }>(null)
  const [coldOpen, setColdOpen] = useState(false)
  const [showFeatureModal, setShowFeatureModal] = useState(false)
  const [usage, setUsage] = useState<any>(null)
  const [search, setSearch] = useState('')

  // Function to fetch usage status
  const fetchUsageStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/cold-email/usage-status`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsage(data.usage);
        return data.usage;
      }
    } catch (error) {
      console.error('Failed to fetch usage status:', error);
    }
    return null;
  };

  // Function to handle email generation with usage update
  const handleGenerate = async (payload: {
    to: string;
    skills: string;
    role?: string;
    company?: string;
    jobTitle?: string;
    projects?: string;
    education?: string;
    portfolioLinks?: string;
    fitSummary?: string;
    ctaPreference?: string;
      tone?: 'professional' | 'tldr' | 'casual' | 'formal' | 'enthusiastic' | 'confident'
      experienceLevel?: 'fresher' | 'intern';
    availability?: string;
    location?: string;
    lowCost?: boolean;
    resumeFile?: File;
    paymentId?: string;
  }) => {
    console.log('Frontend sending payload:', payload);
    console.log('Frontend payload type:', typeof payload);
    
    // Create FormData for file upload
    const formData = new FormData();
    formData.append('to', payload.to);
    formData.append('skills', payload.skills);
    if (payload.role) formData.append('role', payload.role);
    if (payload.company) formData.append('company', payload.company);
    if (payload.jobTitle) formData.append('jobTitle', payload.jobTitle);
    if (payload.projects) formData.append('projects', payload.projects);
    if (payload.education) formData.append('education', payload.education);
    if (payload.portfolioLinks) formData.append('portfolioLinks', payload.portfolioLinks);
    if (payload.fitSummary) formData.append('fitSummary', payload.fitSummary);
    if (payload.ctaPreference) formData.append('ctaPreference', payload.ctaPreference);
    if (payload.tone) formData.append('tone', payload.tone);
    if (payload.experienceLevel) formData.append('experienceLevel', payload.experienceLevel);
    if (payload.availability) formData.append('availability', payload.availability);
    if (payload.location) formData.append('location', payload.location);
    if (payload.lowCost) formData.append('lowCost', payload.lowCost.toString());
    if (payload.resumeFile) formData.append('resumeFile', payload.resumeFile);
    if (payload.paymentId) formData.append('paymentId', payload.paymentId);
    
    const r = await fetch(`${API_BASE}/api/cold-email/generate`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    console.log('Response status:', r.status);
    console.log('Response ok:', r.ok);
    
    if (!r.ok) {
      const errorText = await r.text();
      console.error('Response error:', errorText);
      throw new Error(`Failed to generate: ${r.status} ${errorText}`);
    }
    
    const result = await r.json() as { to: string; subject: string; body: string; reason?: string; usage?: any };
    
    // Refresh usage status after successful generation
    if (result.usage) {
      setUsage(result.usage);
    }
    
    return result;
  };

  // Function to refresh emails
  const refreshEmails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const provider = profile?.provider || 'google';
      const isOutlook = provider === 'microsoft';
      
      // Fetch emails based on current mode
      let url = `${API_BASE}${getApiPath('/messages')}`;
      if (showingOtps) {
        url = `${API_BASE}${getApiPath('/messages/otps')}?limit=300`;
      } else if (unsubscribeMode) {
        const apiUrl = buildApiUrl(getApiPath('/unsubscribe/suggestions'));
        apiUrl.searchParams.set('limit', '200');
        url = apiUrl.toString();
      } else if (aiDeleteMode) {
        const apiUrl = buildApiUrl(getApiPath('/messages/suggest-deletions'));
        apiUrl.searchParams.set('limit', '200');
        apiUrl.searchParams.set('strict', '1');
        apiUrl.searchParams.set('ai', '1');
        if (search.trim()) apiUrl.searchParams.set('q', search.trim());
        url = apiUrl.toString();
      } else {
        // Regular inbox - check if we have search
        if (search.trim()) {
          if (isOutlook) {
            url = `${API_BASE}${getApiPath('/search')}?q=${encodeURIComponent(search.trim())}&maxResults=100`;
          } else {
            url = `${API_BASE}${getApiPath('/messages')}?limit=100&q=${encodeURIComponent(search.trim())}`;
          }
        } else {
          url = `${API_BASE}${getApiPath('/messages')}?${isOutlook ? 'maxResults' : 'limit'}=100`;
        }
      }

      const response = await fetch(url, { credentials: 'include' });
      
      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = `Failed to fetch emails (${response.status})`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          // Couldn't parse error response
        }
        throw new Error(errorMessage);
      }
      
      const json = await response.json();
      
      if (unsubscribeMode) {
        // Map unsubscribe suggestions to email list format
        const list = ((json.suggestions as any[]) || []).map((s) => ({
          id: s.id,
          threadId: s.threadId,
          subject: s.subject || '',
          from: s.from || '',
          date: s.date || '',
          snippet: s.hasOneClick ? 'One‑click unsubscribe available' : 'Unsubscribe available',
        }));
        setEmails(list);
      } else {
        setEmails(json.messages || []);
      }
      
      // Update sent count if not in special modes
      if (!showingOtps && !unsubscribeMode && !aiDeleteMode) {
        try {
          const sentUrl = `${API_BASE}${getApiPath('/messages')}?${isOutlook ? 'maxResults' : 'limit'}=100${isOutlook ? '' : '&folder=sent'}`;
          const sentResp = await fetch(sentUrl, { credentials: 'include' });
          if (sentResp.ok) {
            const sentJson = await sentResp.json();
            setSentCount(Array.isArray(sentJson.messages) ? sentJson.messages.length : 0);
          }
        } catch (e) {
          // Ignore sent count errors
        }
      }
      
    } catch (e: any) {
      const errorMessage = e?.message || 'Failed to refresh emails';
      setError(errorMessage);
      import('sonner').then(({ toast }) => toast.error(errorMessage));
    } finally {
      setLoading(false);
    }
  };

  // Fetch usage status when cold email modal opens
  useEffect(() => {
    if (coldOpen) {
      fetchUsageStatus();
    }
  }, [coldOpen]);

  // Add keyboard shortcut for refresh (Ctrl+R or Cmd+R)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        refreshEmails();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [showingSuggestions, setShowingSuggestions] = useState(false)
  // Show once per session after login: New feature modal
  useEffect(() => {
    try {
      const key = 'feature_cold_v2_seen_session_2025_09'
      // Wait until profile is loaded (user logged in)
      if (profile && !sessionStorage.getItem(key)) {
        setShowFeatureModal(true)
        sessionStorage.setItem(key, '1')
      }
    } catch {}
  }, [profile])
  const [showingOtps, setShowingOtps] = useState(false)
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set())
  const [aiDeleteMode, setAiDeleteMode] = useState(false)
  const [unsubscribeMode, setUnsubscribeMode] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const chatSuggestions = [
    'Show me unread emails from this week',
    'Find emails from John about the project',
    'Summarize my important emails from today',
    'What are my recent conversations?',
    'Show me emails with attachments',
    'Find emails about meetings or schedules',
  ]

  async function addToCategory(categoryId: string, messageId: string) {
    try {
      const r = await fetch(`${API_BASE}${getApiPath(`/categories/${categoryId}/mails`)}`, {
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
      const r = await fetch(`${API_BASE}${getApiPath('/categories')}`, { credentials: 'include' })
      if (!r.ok) return
      const j = await r.json()
      setCategories(j.categories || [])
    } catch {}
  }

  async function loadCategoryMessageIds(catId: string) {
    try {
      const r = await fetch(`${API_BASE}${getApiPath(`/categories/${catId}/mails`)}`, { credentials: 'include' })
      if (!r.ok) return
      const j = await r.json()
      setCategoryMessageIds(new Set<string>((j.messageIds as string[]) || []))
    } catch {}
  }

  useEffect(() => {
    // Wait for profile to be loaded before fetching emails
    if (!profile) {
      console.log('[DEBUG] Waiting for profile to load...')
      return
    }
    
    console.log('[DEBUG] Profile loaded, fetching emails. Provider:', profile.provider)
    
    let cancelled = false
    async function load() {
      try {
        const provider = profile?.provider || 'google'
        const isOutlook = provider === 'microsoft'
        const url = `${API_BASE}${getApiPath('/messages')}?${isOutlook ? 'maxResults' : 'limit'}=100`
        
        console.log('[DEBUG] Fetching emails from:', url)
        const resp = await fetch(url, { credentials: 'include' })
        console.log('[DEBUG] Response status:', resp.status)
        
        if (!resp.ok) throw new Error(`Failed: ${resp.status}`)
        const json = await resp.json()
        console.log('[DEBUG] Received emails:', json.messages?.length || 0, 'messages')
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
        const provider = profile?.provider || 'google'
        const isOutlook = provider === 'microsoft'
        const sentUrl = `${API_BASE}${getApiPath('/messages')}?${isOutlook ? 'maxResults' : 'limit'}=100${isOutlook ? '' : '&folder=sent'}`
        
        const r = await fetch(sentUrl, { credentials: 'include' })
        if (!r.ok) return
        const j = await r.json()
        if (!cancelled) setSentCount(Array.isArray(j.messages) ? j.messages.length : 0)
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [profile])

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
        console.log('[DEBUG] Profile loaded:', j.profile)
        if (!cancelled) setProfile(j.profile || null)
      } catch (error) {
        console.error('[DEBUG] Profile fetch error:', error)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedId || !profile) return
    let cancelled = false
    setDetail(null)
    setSummarizing(false)
    setDetailLoading(true)
    setThreadMessages([]) // Clear thread messages when loading new email
    ;(async () => {
      try {
        const url = `${API_BASE}${getApiPath(`/messages/${selectedId}`)}`
        console.log('[DEBUG] Fetching email detail from:', url)
        const resp = await fetch(url, { credentials: 'include' })
        console.log('[DEBUG] Email detail response status:', resp.status)
        if (!resp.ok) throw new Error(`Failed: ${resp.status}`)
        const json = (await resp.json()) as EmailDetail
        console.log('[DEBUG] Email detail received:', { subject: json.subject, hasBody: !!json.bodyHtml || !!json.bodyText })
        if (!cancelled) setDetail(json)
        // Fetch thread messages for the conversation view (Gmail only for now)
        if (profile.provider !== 'microsoft') {
          try {
            const t = await fetch(`${API_BASE}${getApiPath(`/messages/${selectedId}/thread`)}`, { credentials: 'include' })
            if (t.ok) {
              const tj = await t.json()
              if (!cancelled && Array.isArray(tj.messages)) setThreadMessages(tj.messages)
            }
          } catch {}
        } else {
          // For Outlook, thread messages array stays empty, so main body will be shown
          if (!cancelled) setThreadMessages([])
        }
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
      setUnsubscribeMode(false)
      setSelectedForDelete(new Set())
      setShowingSuggestions(false)
      setShowingOtps(false)
      try {
        setLoading(true)
        const resp = await fetch(`${API_BASE}${getApiPath('/messages')}?limit=100`, { credentials: 'include' })
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
      setUnsubscribeMode(false)
      setSelectedForDelete(new Set())
      setShowingSuggestions(false)
      setShowingOtps(false)
      try {
        setLoading(true)
        const resp = await fetch(`${API_BASE}${getApiPath('/messages')}?limit=100&folder=sent`, { credentials: 'include' })
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
      setUnsubscribeMode(false)
      setSelectedForDelete(new Set())
      setShowingSuggestions(false)
      setShowingOtps(true)
      setLoading(true)
      const r = await fetch(`${API_BASE}${getApiPath('/messages/otps')}?limit=300`, { credentials: 'include' })
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
      setUnsubscribeMode(false)
      setSelectedForDelete(new Set())
      setShowingSuggestions(true)
      setShowingOtps(false)
      setLoading(true)
      const url = buildApiUrl(getApiPath('/messages/suggest-deletions'))
      url.searchParams.set('limit', '200')
      url.searchParams.set('strict', '1')
      url.searchParams.set('ai', '1')
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

  async function handleShowUnsubscribe(onAfterAction?: () => void) {
    try {
      setSelectedCategory(null)
      setAiDeleteMode(false)
      setShowingOtps(false)
      setShowingSuggestions(false)
      setUnsubscribeMode(true)
      setLoading(true)
      const url = buildApiUrl(getApiPath('/unsubscribe/suggestions'))
      url.searchParams.set('limit', '200')
      const r = await fetch(url.toString(), { credentials: 'include' })
      if (r.ok) {
        const j = await r.json()
        // Map suggestions into the email list shape for rendering
        const list = ((j.suggestions as any[]) || []).map((s) => ({
          id: s.id,
          threadId: s.threadId,
          subject: s.subject || '',
          from: s.from || '',
          date: s.date || '',
          snippet: s.hasOneClick ? 'One‑click unsubscribe available' : 'Unsubscribe available',
        }))
        setEmails(list)
      }
    } catch {}
    finally {
      setLoading(false)
      onAfterAction?.()
    }
  }

  return (
    <div className="h-screen w-full overflow-x-hidden bg-neutral-950 text-neutral-100 no-anim">
      {/* Authentication Loading Overlay */}
      {!profile && (
        <div className="fixed inset-0 bg-neutral-950 z-50 flex items-center justify-center">
          <LoaderOne />
        </div>
      )}
      <div className="flex h-full overflow-x-hidden">
        {/* Mobile slide-over sidebar */}
        {sidebarOpen ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-neutral-800 bg-neutral-950 p-3 flex flex-col overflow-hidden">
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
            onShowUnsubscribe={() => handleShowUnsubscribe(() => setSidebarOpen(false))}
                categories={categories}
                onAddCategory={async (name) => {
                  const r = await fetch(`${API_BASE}${getApiPath('/categories')}`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name }),
                  })
                  if (r.ok) await loadCategories()
                }}
                onRemoveCategory={async (id) => {
                  const r = await fetch(`${API_BASE}${getApiPath(`/categories/${id}`)}`, {
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
            onShowUnsubscribe={() => handleShowUnsubscribe()}
            categories={categories}
            onAddCategory={async (name) => {
              const r = await fetch(`${API_BASE}${getApiPath('/categories')}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
              })
              if (r.ok) await loadCategories()
            }}
            onRemoveCategory={async (id) => {
              const r = await fetch(`${API_BASE}${getApiPath(`/categories/${id}`)}`, {
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
                    const r = await fetch(`${API_BASE}${getApiPath('/messages')}?limit=100&q=${encodeURIComponent(q)}`, { credentials: 'include' })
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
            <button
              className="size-9 inline-flex items-center justify-center rounded-md border border-neutral-800 hover:bg-neutral-900 disabled:opacity-50"
              onClick={refreshEmails}
              disabled={loading}
              title="Refresh emails"
              aria-label="Refresh emails"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {search ? (
              <button
                className="text-xs text-neutral-400 hover:text-neutral-200"
                onClick={() => {
                  setSearch('')
                  // reload inbox on clear
                  ;(async () => {
                    try {
                      setLoading(true)
                      const resp = await fetch(`${API_BASE}${getApiPath('/messages')}?limit=100`, { credentials: 'include' })
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
                      const url = buildApiUrl(getApiPath('/messages/suggest-deletions'))
                      url.searchParams.set('limit', '200')
                      url.searchParams.set('strict', '1')
                      url.searchParams.set('ai', '1')
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
                      const r = await fetch(`${API_BASE}${getApiPath('/messages/bulk-delete')}`, {
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
                      const r = await fetch(`${API_BASE}${getApiPath('/messages/otps')}?limit=300`, { credentials: 'include' })
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
                      const r = await fetch(`${API_BASE}${getApiPath('/messages/bulk-delete')}`, {
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
            ) : unsubscribeMode ? (
              <div className="flex items-center gap-1 ml-2">
                <button
                  className="size-8 grid place-items-center rounded-md border border-neutral-800 hover:bg-neutral-900"
                  title="Refresh unsubscribe suggestions"
                  aria-label="Refresh unsubscribe suggestions"
                  onClick={async () => {
                    try {
                      setLoading(true)
                      const url = buildApiUrl(getApiPath('/unsubscribe/suggestions'))
                      url.searchParams.set('limit', '200')
                      const r = await fetch(url.toString(), { credentials: 'include' })
                      if (!r.ok) throw new Error('Failed')
                      const j = await r.json()
                      const list = ((j.suggestions as any[]) || []).map((s: any) => ({
                        id: s.id,
                        threadId: s.threadId,
                        subject: s.subject || '',
                        from: s.from || '',
                        date: s.date || '',
                        snippet: s.hasOneClick ? 'One‑click unsubscribe available' : 'Unsubscribe available',
                      }))
                      setEmails(list)
                      setSelectedForDelete(new Set())
                    } catch (e) {
                      setError('Failed to refresh unsubscribe suggestions')
                    } finally {
                      setLoading(false)
                    }
                  }}
                >
                  <Sparkles className="size-4 text-emerald-300" />
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
                  className={`size-8 grid place-items-center rounded-md border ${selectedForDelete.size === 0 ? 'border-neutral-900 text-neutral-600' : 'border-emerald-700/40 text-emerald-300 hover:bg-emerald-600/10'}`}
                  title="Unsubscribe selected"
                  aria-label="Unsubscribe selected"
                  onClick={async () => {
                    if (selectedForDelete.size === 0) return
                    const ok = window.confirm(`Unsubscribe using available links for ${selectedForDelete.size} selected email(s)?`)
                    if (!ok) return
                    try {
                      const ids = Array.from(selectedForDelete)
                      const r = await fetch(`${API_BASE}${getApiPath('/unsubscribe/execute')}`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ids, confirm: true }),
                      })
                      if (!r.ok) throw new Error('Failed')
                      const j = await r.json()
                      const okIds = new Set<string>((j.results || []).filter((x: any) => x.ok).map((x: any) => x.id))
                      if (okIds.size > 0) {
                        setEmails((list) => list.filter((m) => !okIds.has(m.id)))
                        if (selectedId && okIds.has(selectedId)) {
                          setDetail(null)
                          setSelectedId(null)
                        }
                      }
                      import('sonner').then(({ toast }) => toast.success(`Unsubscribed ${j.success || 0} thread(s)`))
                      setSelectedForDelete(new Set())
                    } catch (e) {
                      import('sonner').then(({ toast }) => toast.error('Unsubscribe failed'))
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
                <button
                  className="size-8 grid place-items-center rounded-md border border-neutral-800 hover:bg-neutral-900"
                  title="Exit Smart unsubscribe"
                  aria-label="Exit Smart unsubscribe"
                  onClick={() => {
                    setUnsubscribeMode(false)
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
              {aiDeleteMode ? (
                <div className="px-2 pt-2">
                  <div className="rounded-lg border border-violet-800/30 bg-violet-950/20 p-4 flex items-start gap-3">
                    <Sparkles className="size-5 text-violet-300 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-neutral-200 font-medium">Invoxus is reviewing your emails…</div>
                      <div className="text-xs text-neutral-400 mt-1">Finding newsletters, promos, and low‑value messages to clean up.</div>
                      <div className="mt-3 pl-1 pb-1"><LoaderOne /></div>
                    </div>
                  </div>
                </div>
              ) : showingOtps ? (
                <div className="px-2 pt-2">
                  <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-4 flex items-start gap-3">
                    <Sparkles className="size-5 text-amber-300 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-neutral-200 font-medium">Invoxus is scanning for OTPs…</div>
                      <div className="text-xs text-neutral-400 mt-1">Detecting verification codes across recent messages.</div>
                      <div className="mt-3 pl-1 pb-1"><LoaderOne /></div>
                    </div>
                  </div>
                </div>
              ) : unsubscribeMode ? (
                <div className="px-2 pt-2">
                  <div className="rounded-lg border border-emerald-800/30 bg-emerald-950/20 p-4 flex items-start gap-3">
                    <Sparkles className="size-5 text-emerald-300 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-neutral-200 font-medium">Invoxus is fetching unsubscribe options…</div>
                      <div className="text-xs text-neutral-400 mt-1">Looking for one‑click and email‑based unsubscribe links.</div>
                      <div className="mt-3 pl-1 pb-1"><LoaderOne /></div>
                    </div>
                  </div>
                </div>
              ) : null}
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
                    : unsubscribeMode
                    ? 'Smart unsubscribe'
                    : aiDeleteMode
                    ? showingSuggestions
                      ? 'AI suggested deletes'
                      : 'AI delete'
                    : selectedCategory
                    ? 'Category'
                    : 'Primary'
                } />
                {showingOtps && !loading && primaryItems.length === 0 ? (
                  <div className="py-12 flex items-center justify-center text-sm text-neutral-500">
                    No OTPs found
                  </div>
                ) : (
                  <ul className="divide-y divide-neutral-900">
                    {primaryItems.map((m) => (
                      <EmailListRow
                        key={m.id}
                        m={m}
                        onClick={() => setSelectedId(m.id)}
                        selected={selectedId === m.id}
                        selectMode={aiDeleteMode || unsubscribeMode}
                        selectedForDelete={selectedForDelete.has(m.id)}
                        onToggleSelect={() => toggleSelected(m.id)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Right detail */}
        <section className={`flex-1 flex flex-col ${selectedId ? '' : 'hidden'} md:flex`}>
          {/* moved ComposeModal to global area below to ensure it renders on mobile */}
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
                        const resp = await fetch(`${API_BASE}${getApiPath(`/messages/${detail.id}/star`)}`, {
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
                        const url = `${API_BASE}${getApiPath(`/messages/${detail.id}`)}`
                        const r = await fetch(url, {
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
                    const url = `${API_BASE}${getApiPath(`/messages/${detail.id}/summarize`)}`
                    const sum = await fetch(url, {
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
                {/* If no thread messages (e.g., Outlook), show the main email body */}
                {threadMessages.length === 0 && detail ? (
                  <div className="group">
                    <div className="mb-2 text-xs text-neutral-500">
                      {detail.from} • {new Date(detail.date).toLocaleString()}
                    </div>
                    {detail.bodyHtml ? (
                      <EmailHtmlFrame html={sanitizeHtmlForDark(detail.bodyHtml)} />
                    ) : detail.bodyText ? (
                      <pre className="whitespace-pre-wrap text-sm text-neutral-200">{detail.bodyText}</pre>
                    ) : (
                      <div className="text-sm text-neutral-500">No content</div>
                    )}
                  </div>
                ) : null}
                
                {/* Thread messages (Gmail threads or multiple messages) */}
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
                              await fetch(`${API_BASE}${getApiPath(`/categories/${selectedCategory}/mails`)}`, {
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
                      const url = `${API_BASE}${getApiPath(`/messages/${detail.id}/suggest-reply`)}`
                      const r = await fetch(url, {
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
                    const url = `${API_BASE}${getApiPath(`/messages/${detail.id}/reply`)}`
                    const r = await fetch(url, {
                      method: 'POST',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ body: text }),
                    })
                    if (!r.ok) {
                      import('sonner').then(({ toast }) => toast.error('Failed to send reply'))
                    } else {
                      // Refresh thread so the new reply appears under the original (Gmail only)
                      if (profile?.provider !== 'microsoft') {
                        try {
                          const threadUrl = `${API_BASE}${getApiPath(`/messages/${detail.id}/thread`)}`
                          const t = await fetch(threadUrl, {
                            credentials: 'include',
                          })
                          if (t.ok) {
                            const tj = await t.json()
                            if (Array.isArray(tj.messages)) setThreadMessages(tj.messages)
                          }
                        } catch {}
                      } else {
                        // For Outlook, just show success
                        import('sonner').then(({ toast }) => toast.success('Reply sent'))
                      }
                    }
                  }}
                />
              </div>
            </div>
          ) : null}
        </section>
      </div>
      {/* Global modals to ensure they open on mobile */}
      {composeOpen ? (
        <ComposeModal
          profile={profile}
          onClose={() => setComposeOpen(false)}
          onSend={async (payload) => {
            const url = `${API_BASE}${getApiPath('/messages/send')}`
            const r = await fetch(url, {
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
      {coldOpen ? (
        <ComposeColdEmailModal
          onClose={() => setColdOpen(false)}
          onGenerate={handleGenerate}
          usage={usage}
          onSend={async (payload: { to: string; subject: string; body: string; resumeFile?: File }) => {
            try {
              // Create FormData for file upload
              const formData = new FormData();
              formData.append('to', payload.to);
              formData.append('subject', payload.subject);
              formData.append('body', payload.body);
              if (payload.resumeFile) {
                formData.append('resumeFile', payload.resumeFile);
              }
              
              const r = await fetch(`${API_BASE}/api/cold-email/send`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
              });
              
              if (!r.ok) {
                // Try to parse error message from response
                let errorMessage = 'Failed to send email';
                try {
                  const errorData = await r.json();
                  errorMessage = errorData.message || errorData.error || errorMessage;
                } catch (e) {
                  // Couldn't parse error response
                }
                
                // Show specific error message
                import('sonner').then(({ toast }) => toast.error(errorMessage));
                throw new Error(errorMessage);
              }
              
              return true;
            } catch (error: any) {
              // Error already shown via toast
              throw error;
            }
          }}
        />
      ) : null}
      {showFeatureModal ? (
        <NewFeatureModal
          onClose={() => setShowFeatureModal(false)}
          onTryCold={() => {
            setShowFeatureModal(false)
            setColdOpen(true)
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
          onEmailClick={(emailId: string) => {
            // Close chat and open the email in dashboard
            setChatModalOpen(false)
            setSelectedId(emailId)
          }}
          onConfirmSend={async ({ to, subject, body }) => {
            const sr = await fetch(`${API_BASE}${getApiPath('/messages/send')}`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ to, subject, body }),
            })
            if (sr.ok) {
              setChatHistory((h) => [...h, { role: 'assistant', text: `Email sent to ${to}` }])
              setChatPendingSend(null)
              try {
                const resp = await fetch(`${API_BASE}${getApiPath('/messages')}?limit=100`, { credentials: 'include' })
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
          onAsk={async (q, limit = 50) => {
            setChatHistory((h) => [...h, { role: 'user', text: q }])
            try {
              const r = await fetch(`${API_BASE}/api/chat/ask`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: q, limit }),
              })
              const contentType = r.headers.get('content-type') || ''
              if (!r.ok) {
                await r.text().catch(() => '')
                setChatHistory((h) => [...h, { role: 'assistant', text: 'Sorry, I could not answer.' }])
              } else if (contentType.includes('application/json')) {
                const j = await r.json()
                const a = j?.answer || 'No answer'
                const emailsScanned = j?.messages?.length || 0
                let responseText = a
                if (emailsScanned > 0) {
                  responseText += `\n\n_Scanned ${emailsScanned} of up to ${limit} email${limit !== 1 ? 's' : ''}_`
                }
                // Only store emails if the intent is to show/search emails (not compose/send)
                const shouldShowEmails = j?.action !== 'send' && j?.action !== 'schedule' && j?.action !== 'compose'
                const foundEmails = shouldShowEmails ? (j?.messages || []) : []
                setChatHistory((h) => [...h, { role: 'assistant', text: responseText, emails: foundEmails }])

                  if (j?.action === 'send') {
                    // Always surface preview form on first pass; try to smart-fill "to" from assistant payload or recent participants
                    let toEmail = j?.send?.toEmail || ''
                    const subject = j?.send?.subject || 'Quick note'
                    const body = j?.send?.body || a || 'Thank you!'
                    if (!toEmail && Array.isArray(j?.messages)) {
                      // Prefer the top sender from results when user asked to send to a person
                      const first = j.messages[0]
                      if (first && typeof first.from === 'string') {
                        const m = String(first.from).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
                        if (m) toEmail = m[0]
                      }
                    }
                    setChatPendingSend({ toEmail, subject, body })
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
  onShowUnsubscribe,
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
  onShowUnsubscribe: () => void
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
          <button
            className="group w-full inline-flex items-center justify-between py-2 text-sm hover:bg-neutral-900/30 transition-colors"
            onClick={onShowUnsubscribe}
          >
            <span className="inline-flex items-center gap-3">
              <Trash2 className="size-4 text-white" />
              <span>Smart unsubscribe</span>
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
        <div className="pt-1 pb-2 text-center">
          <a
            href="https://invoxus.email/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-neutral-500 hover:text-neutral-300 underline decoration-neutral-700 hover:decoration-neutral-400"
          >
            Privacy Policy
          </a>
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
  onEmailClick,
}: {
  onClose: () => void
  suggestions: string[]
  history: Array<{ role: 'user' | 'assistant'; text: string; emails?: any[] }>
  pendingSend: null | { toEmail: string; subject: string; body: string }
  onCancelPendingSend: () => void
  onConfirmSend: (p: { to: string; subject: string; body: string }) => Promise<boolean>
  onAsk: (q: string, limit?: number) => Promise<void>
  onEmailClick?: (emailId: string) => void
}) {
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
                  <div className="text-lg font-medium text-white mb-2">AI Email Assistant</div>
                  <div className="text-sm text-gray-400">Smart email management powered by AI</div>
                </div>
                
                {/* Quick Action Buttons */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-white text-sm transition-colors group disabled:opacity-50"
                    disabled={sending}
                    onClick={async () => {
                      const q = "Show me important unread emails";
                      setValue('');
                      setSending(true);
                      await onAsk(q, scanLimit);
                      setSending(false);
                    }}
                  >
                    <AlertCircle className="w-4 h-4 text-white/80 group-hover:text-white" />
                    <span>Important</span>
                  </button>
                  <button
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-white text-sm transition-colors group disabled:opacity-50"
                    disabled={sending}
                    onClick={async () => {
                      const q = "Summarize my important emails from today";
                      setValue('');
                      setSending(true);
                      await onAsk(q, scanLimit);
                      setSending(false);
                    }}
                  >
                    <FileText className="w-4 h-4 text-white/80 group-hover:text-white" />
                    <span>Summarize</span>
                  </button>
                  <button
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-white text-sm transition-colors group disabled:opacity-50"
                    disabled={sending}
                    onClick={async () => {
                      const q = "Show me recent emails with attachments";
                      setValue('');
                      setSending(true);
                      await onAsk(q, scanLimit);
                      setSending(false);
                    }}
                  >
                    <Search className="w-4 h-4 text-white/80 group-hover:text-white" />
                    <span>Attachments</span>
                  </button>
                  <button
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-white text-sm transition-colors group disabled:opacity-50"
                    disabled={sending}
                    onClick={async () => {
                      const q = "What emails need my response?";
                      setValue('');
                      setSending(true);
                      await onAsk(q, scanLimit);
                      setSending(false);
                    }}
                  >
                    <Mail className="w-4 h-4 text-white/80 group-hover:text-white" />
                    <span>Action Needed</span>
                  </button>
                </div>
                
                <div className="border-t border-white/10 pt-4 mt-2">
                  <div className="text-xs text-gray-500 mb-2 font-medium">Try asking:</div>
                  <div className="grid grid-cols-1 gap-2">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        className="text-left px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm transition-colors disabled:opacity-50"
                        disabled={sending}
                        onClick={async () => {
                          setValue('');
                          setSending(true);
                          await onAsk(s, scanLimit);
                          setSending(false);
                        }}
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
                <div key={idx} className="space-y-2">
                  <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
                  
                  {/* Render clickable email cards if emails are present */}
                  {m.role === 'assistant' && m.emails && m.emails.length > 0 && (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] space-y-2">
                        {m.emails.slice(0, 5).map((email: any, emailIdx: number) => (
                          <button
                            key={emailIdx}
                            onClick={() => onEmailClick?.(email.id)}
                            className="w-full text-left px-4 py-3 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 transition-colors group"
                          >
                            <div className="flex items-start gap-3">
                              <Mail className="w-4 h-4 text-white/60 group-hover:text-white/80 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-white truncate">
                                  {email.subject || '(No Subject)'}
                                </div>
                                <div className="text-xs text-white/60 truncate mt-0.5">
                                  {email.from || 'Unknown sender'}
                                </div>
                                {email.snippet && (
                                  <div className="text-xs text-white/40 line-clamp-1 mt-1">
                                    {email.snippet}
                                  </div>
                                )}
                                {email.date && (
                                  <div className="text-xs text-white/40 mt-1">
                                    {new Date(email.date).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-white/40 group-hover:text-white/60">→</div>
                            </div>
                          </button>
                        ))}
                        {m.emails.length > 5 && (
                          <div className="text-xs text-white/40 text-center py-1">
                            + {m.emails.length - 5} more emails
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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

            {/* Preview & send panel – pinned below messages, above input */}
            {pendingSend ? (
              <div className="mt-2">
                <PendingSendForm
                  draft={pendingSend}
                  onCancel={onCancelPendingSend}
                  onConfirm={onConfirmSend}
                />
              </div>
            ) : null}

            {/* Feedback (minimal) */}
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

            {/* Quick Actions - Always visible after first message */}
            {history.length > 0 && !showExamples ? (
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="text-xs text-gray-500 mb-1.5 font-medium">Quick Actions</div>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    className="flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-white text-xs transition-colors group disabled:opacity-50"
                    disabled={sending}
                    onClick={async () => {
                      const q = "Show me important unread emails";
                      setValue('');
                      setSending(true);
                      await onAsk(q, scanLimit);
                      setSending(false);
                    }}
                  >
                    <AlertCircle className="w-4 h-4 text-white/80 group-hover:text-white" />
                    <span>Important</span>
                  </button>
                  <button
                    className="flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-white text-xs transition-colors group disabled:opacity-50"
                    disabled={sending}
                    onClick={async () => {
                      const q = "Summarize my important emails from today";
                      setValue('');
                      setSending(true);
                      await onAsk(q, scanLimit);
                      setSending(false);
                    }}
                  >
                    <FileText className="w-4 h-4 text-white/80 group-hover:text-white" />
                    <span>Summarize</span>
                  </button>
                  <button
                    className="flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-white text-xs transition-colors group disabled:opacity-50"
                    disabled={sending}
                    onClick={async () => {
                      const q = "Show me recent emails with attachments";
                      setValue('');
                      setSending(true);
                      await onAsk(q, scanLimit);
                      setSending(false);
                    }}
                  >
                    <Search className="w-4 h-4 text-white/80 group-hover:text-white" />
                    <span>Attachments</span>
                  </button>
                  <button
                    className="flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-white text-xs transition-colors group disabled:opacity-50"
                    disabled={sending}
                    onClick={async () => {
                      const q = "What emails need my response?";
                      setValue('');
                      setSending(true);
                      await onAsk(q, scanLimit);
                      setSending(false);
                    }}
                  >
                    <Mail className="w-4 h-4 text-white/80 group-hover:text-white" />
                    <span>Action Needed</span>
                  </button>
                </div>
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
                    'Find emails from Sarah about the meeting...',
                    'Summarize my emails from this week...',
                    'Show me important unread messages...',
                    'What did Alex say about the project?',
                    'Find emails with documents or attachments...',
                    'Help me write a reply to the latest email...',
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
  profile,
}: {
  onClose: () => void
  onSend: (payload: { to: string; cc?: string; bcc?: string; subject: string; body: string; attachments?: Array<{ filename: string; contentType?: string; dataBase64: string }> }) => Promise<void>
  profile: UserProfile | null
}) {
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
        const provider = profile?.provider || 'google'
        const apiPrefix = provider === 'microsoft' ? '/api/outlook' : '/api/gmail'
        const r = await fetch(`${API_BASE}${apiPrefix}/contacts?limit=600`, { credentials: 'include' })
        if (r.ok) {
          const j = await r.json()
          const list = (j.contacts || []).map((c: any) => ({ name: c.name, email: c.email }))
          setSuggestions(list)
          try { localStorage.setItem('invoxus_contacts_cache_v1', JSON.stringify(list)) } catch {}
          return
        }
        // Fallback: build from recent messages
        const r2 = await fetch(`${API_BASE}${apiPrefix}/messages?limit=200`, { credentials: 'include' })
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
  }, [profile])

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
  usage,
}: {
  onClose: () => void
  onGenerate: (
    p: {
      to: string
      skills: string
      role?: string
      company?: string
      industry?: string
      jobTitle?: string
      projects?: string
      education?: string
      portfolioLinks?: string
      fitSummary?: string
      ctaPreference?: string
      tone?: 'professional' | 'tldr' | 'casual' | 'formal' | 'enthusiastic' | 'confident'
      experienceLevel?: 'fresher' | 'intern'
      availability?: string
      location?: string
      lowCost?: boolean
      resumeFile?: File
      paymentId?: string
    }
  ) => Promise<{ to: string; subject: string; body: string; reason?: string }>
  onSend: (p: { to: string; subject: string; body: string; resumeFile?: File }) => Promise<boolean>
  usage?: any
}) {
  const [to, setTo] = useState('')
  const [role, setRole] = useState('HR')
  const [company, setCompany] = useState('')
  const [skills, setSkills] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [projects, setProjects] = useState('')
  const [education, setEducation] = useState('')
  const [portfolioLinks, setPortfolioLinks] = useState('')
  const [fitSummary, setFitSummary] = useState('')
  const [ctaPreference, setCtaPreference] = useState('')
  const [tone, setTone] = useState<'professional' | 'tldr' | 'casual' | 'formal' | 'enthusiastic' | 'confident'>('professional')
  const [experienceLevel, setExperienceLevel] = useState<'fresher' | 'intern'>('fresher')
  const [availability, setAvailability] = useState('')
  const [location, setLocation] = useState('')
  const [lowCost, setLowCost] = useState(false)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [suggestionNote, setSuggestionNote] = useState<string | null>(null)
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const previewRef = useRef<HTMLDivElement | null>(null)
  const resumeInputRef = useRef<HTMLInputElement | null>(null)

  // Fetch AI-driven suggestions when job title changes; only fill empty fields
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      if (!jobTitle.trim() || jobTitle.trim().length < 2) return
      try {
        const r = await fetch(`${API_BASE}/api/cold-email/suggest`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ industry: '', role, company, skills, jobTitle, portfolioLinks, experienceLevel }),
          signal: controller.signal,
        })
        if (!r.ok) return
        const s: {
          skills?: string
          projects?: string
          education?: string
          fitSummary?: string
          portfolioLinks?: string
          ctaPreference?: string
          tone?: 'professional' | 'tldr'
          experienceLevel?: 'fresher' | 'intern'
          availability?: string
          location?: string
        } = await r.json()
        let applied = false
        if (s.skills && !skills.trim()) { setSkills(s.skills); applied = true }
        if (s.projects && !projects.trim()) { setProjects(s.projects); applied = true }
        if (s.education && !education.trim()) { setEducation(s.education); applied = true }
        if (s.fitSummary && !fitSummary.trim()) { setFitSummary(s.fitSummary); applied = true }
        if (s.portfolioLinks && !portfolioLinks.trim()) { setPortfolioLinks(s.portfolioLinks); applied = true }
        if (s.ctaPreference && !ctaPreference.trim()) { setCtaPreference(s.ctaPreference); applied = true }
        if (s.availability && !availability.trim()) { setAvailability(s.availability); applied = true }
        if (s.location && !location.trim()) { setLocation(s.location); applied = true }
        if (s.tone && tone === 'professional') { setTone(s.tone) }
        if (s.experienceLevel && experienceLevel === 'fresher') { setExperienceLevel(s.experienceLevel) }
        if (applied) {
          setSuggestionNote('✨ AI suggestions applied based on job title')
          setTimeout(() => setSuggestionNote(null), 2500)
        }
      } catch {}
    }, 350)
    return () => { controller.abort(); clearTimeout(timer) }
  }, [jobTitle])

  const toInvalid = !!to && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)
  const wordCount = body ? body.trim().split(/\s+/).filter(Boolean).length : 0
  const previewReady = !!subject || !!body
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-stretch md:items-start justify-center">
      <div className="mt-0 md:mt-10 w-full md:w-auto h-full md:h-auto md:max-w-5xl lg:max-w-6xl max-w-[100vw] rounded-none md:rounded-2xl border border-neutral-800 bg-neutral-950 shadow-xl overflow-hidden flex flex-col relative">
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-neutral-950/95 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="text-center flex flex-col items-center justify-center">
              <div className="mb-6">
                <LoaderOne />
              </div>
              <div className="text-sm text-neutral-300">Crafting your personalized outreach...</div>
              <div className="text-xs text-neutral-500 mt-1">Our AI is tailoring your message for maximum impact</div>
            </div>
          </div>
        )}
        
        {/* Sending Overlay */}
        {sending && (
          <div className="absolute inset-0 bg-neutral-950/95 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="text-center flex flex-col items-center justify-center">
              <div className="mb-6">
                <LoaderOne />
              </div>
              <div className="text-sm text-neutral-300">Sending your email...</div>
              <div className="text-xs text-neutral-500 mt-1">Please wait while we deliver your message</div>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-violet-400" />
            <div>
              <div className="text-sm font-medium text-neutral-200">Cold email</div>
              <div className="text-xs text-neutral-500">Generate networking outreach to talent acquisition teams • 10/day limit</div>
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
                <label className="block text-xs text-neutral-500 mb-1">Job title you're targeting</label>
                <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700" placeholder="e.g. Frontend Engineer" />
                {suggestionNote ? <div className="mt-1 text-[11px] text-violet-300">{suggestionNote}</div> : null}
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Key skills</label>
                <textarea value={skills} onChange={(e) => setSkills(e.target.value)} className="min-h-[72px] w-full resize-y rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700" placeholder="e.g. React, TypeScript, Node, Tailwind, testing" />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Notable projects</label>
                <textarea value={projects} onChange={(e) => setProjects(e.target.value)} className="min-h-[72px] w-full resize-y rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700" placeholder="e.g. E-commerce platform (React, Node.js) - increased sales 30%, Mobile app (React Native) - 10k+ downloads" />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Education</label>
                <textarea value={education} onChange={(e) => setEducation(e.target.value)} className="min-h-[56px] w-full resize-y rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700" placeholder="e.g. B.S. Computer Science, Stanford University, 2020" />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Portfolio / links</label>
                <textarea value={portfolioLinks} onChange={(e) => setPortfolioLinks(e.target.value)} className="min-h-[56px] w-full resize-y rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700" placeholder="e.g. linkedin.com/in/yourname, github.com/username, website, case studies" />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Resume (optional)</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => resumeInputRef.current?.click()}
                    className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-left hover:bg-neutral-800 transition-colors flex items-center justify-between"
                  >
                    <span className={resumeFile ? 'text-neutral-200' : 'text-neutral-500'}>
                      {resumeFile ? resumeFile.name : 'Click to upload resume (PDF, DOC, DOCX)'}
                    </span>
                    <Paperclip className="size-4 text-neutral-400" />
                  </button>
                  <input
                    ref={resumeInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        // Validate file size (max 5MB)
                        if (file.size > 5 * 1024 * 1024) {
                          setError('Resume file too large. Please choose a file under 5MB.')
                          return
                        }
                        // Validate file type
                        const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
                        if (!validTypes.includes(file.type)) {
                          setError('Please upload a PDF, DOC, or DOCX file.')
                          return
                        }
                        setResumeFile(file)
                        setError(null)
                      }
                    }}
                    className="hidden"
                  />
                  {resumeFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setResumeFile(null)
                        if (resumeInputRef.current) resumeInputRef.current.value = ''
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-300"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
                {resumeFile && (
                  <div className="mt-1 text-[11px] text-green-400 flex items-center gap-1">
                    <Check className="size-3" />
                    Resume attached - will be included in email
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Why you’re a fit (optional)</label>
                <textarea value={fitSummary} onChange={(e) => setFitSummary(e.target.value)} className="min-h-[56px] w-full resize-y rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700" placeholder="1–2 lines tailored to the company" />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Availability</label>
                <input value={availability} onChange={(e) => setAvailability(e.target.value)} className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700" placeholder="e.g. immediate, 2 weeks notice" />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Location (optional)</label>
                <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700" placeholder="e.g. Remote, Bengaluru" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">CTA preference</label>
                  <input value={ctaPreference} onChange={(e) => setCtaPreference(e.target.value)} className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700" placeholder="e.g. 10-min intro, quick reply, forward to owner" />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">Tone {paymentId && <span className="text-violet-400 text-[10px]">(Premium)</span>}</label>
                  <select value={tone} onChange={(e) => setTone(e.target.value as any)} className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700">
                    <option value="professional">Professional</option>
                    <option value="tldr">TL;DR (Concise)</option>
                    <option value="casual" disabled={!paymentId}>⭐ Casual & Friendly {!paymentId ? '(Premium)' : ''}</option>
                    <option value="formal" disabled={!paymentId}>⭐ Formal & Executive {!paymentId ? '(Premium)' : ''}</option>
                    <option value="enthusiastic" disabled={!paymentId}>⭐ Enthusiastic & Energetic {!paymentId ? '(Premium)' : ''}</option>
                    <option value="confident" disabled={!paymentId}>⭐ Confident & Direct {!paymentId ? '(Premium)' : ''}</option>
                  </select>
                  {!paymentId && ['casual', 'formal', 'enthusiastic', 'confident'].includes(tone) && (
                    <div className="mt-1 text-[10px] text-amber-400">
                      ⚠️ This tone requires payment. Click "Pay & Generate" below.
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Experience Level</label>
                <select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value as any)} className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-700">
                  <option value="fresher">Fresher (New Graduate)</option>
                  <option value="intern">Intern (Seeking Internship)</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs text-neutral-300 select-none">
                <input type="checkbox" checked={lowCost} onChange={(e) => setLowCost(e.target.checked)} className="accent-blue-600" />
                High quality mode (more tokens, better output)
              </label>
              {error ? <div className="text-xs text-red-400">{error}</div> : null}
              <div className="flex items-center gap-2 pt-1">
                {!paymentId && (['casual', 'formal', 'enthusiastic', 'confident'].includes(tone) || (!usage || usage.remainingFreeGenerations === 0)) ? (
                  <button
                    disabled={loading || toInvalid}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                    onClick={() => setShowPayment(true)}
                  >
                    <Wand2 className="size-4" />
                    Pay ₹1 & Generate Email
                  </button>
                ) : (
                  <button
                    disabled={loading || toInvalid}
                    className="inline-flex items-center gap-2 rounded-md border border-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-900 disabled:opacity-50"
                    onClick={async () => {
                      try {
                        setLoading(true)
                        setError(null)
                        const d = await onGenerate({
                          to,
                          skills,
                          role,
                          company,
                          jobTitle,
                          projects,
                          education,
                          portfolioLinks,
                          fitSummary,
                          ctaPreference,
                          tone,
                          experienceLevel,
                          availability,
                          location,
                          lowCost,
                          resumeFile: resumeFile || undefined,
                          paymentId: paymentId || undefined,
                        })
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
                      } catch (e: any) {
                        console.error('Generate error:', e)
                        setError(e?.message || 'Failed to generate draft')
                        import('sonner').then(({ toast }) => toast.error('Failed to generate draft'))
                      } finally {
                        setLoading(false)
                      }
                    }}
                  >
                    <Wand2 className="size-4" />
                    {loading ? 'Generating…' : previewReady ? 'Regenerate' : 'Generate draft'}
                  </button>
                )}
                <div className="text-xs text-neutral-500">
                  {paymentId ? 'AI creates a short, tailored draft.' : 
                   ['casual', 'formal', 'enthusiastic', 'confident'].includes(tone) ? 
                   '⭐ Premium tone selected - payment required' :
                   usage && usage.remainingFreeGenerations > 0 ? 
                   `Free generation available (${usage.remainingFreeGenerations} left)` : 
                   'Payment required to generate email.'}
                </div>
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
              disabled={!to.trim() || toInvalid || !subject.trim() || !body.trim() || sending}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-1.5 text-sm"
              onClick={async () => {
                try {
                  setSending(true)
                  const ok = await onSend({ to, subject, body, resumeFile: resumeFile || undefined })
                  if (ok) {
                    import('sonner').then(({ toast }) => toast.success('Email sent successfully!'))
                    onClose()
                  }
                } catch (e: any) {
                  setError('Failed to send email')
                  import('sonner').then(({ toast }) => toast.error('Failed to send email'))
                } finally {
                  setSending(false)
                }
              }}
            >
              <Send className="size-4" />
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-lg shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-neutral-100">Payment Required</h3>
                <button 
                  onClick={() => setShowPayment(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <PaymentComponent
                onPaymentSuccess={async (paymentId) => {
                  setPaymentId(paymentId);
                  setShowPayment(false);
                  if (paymentId === 'free_generation') {
                    import('sonner').then(({ toast }) => toast.success('Free email generated successfully!'));
                  } else {
                    import('sonner').then(({ toast }) => toast.success('Payment successful! You can now generate your email.'));
                  }
                }}
                onPaymentError={(error) => {
                  console.error('Payment error:', error);
                  import('sonner').then(({ toast }) => toast.error('Payment failed. Please try again.'));
                }}
                serviceData={{
                  to,
                  skills,
                  role,
                  company,
                  jobTitle,
                  projects,
                  education,
                  portfolioLinks,
                  fitSummary,
                  ctaPreference,
                  tone,
                  experienceLevel,
                  availability,
                  location,
                  lowCost,
                  resumeFile: resumeFile?.name || undefined
                }}
                usage={usage}
              />
            </div>
          </div>
        </div>
      )}
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



import { useState, useRef, useEffect } from 'react'
import { X, Wand2, Send, Paperclip, Check, Sparkles } from 'lucide-react'
import { LoaderOne } from '../../loader'
import PaymentComponent from '../../PaymentComponent'
import { API_BASE } from '../utils'
import type { ColdEmailPayload } from '../types'

type ComposeColdEmailModalProps = {
  onClose: () => void
  onGenerate: (p: ColdEmailPayload) => Promise<{ to: string; subject: string; body: string; reason?: string }>
  onSend: (p: { to: string; subject: string; body: string; resumeFile?: File }) => Promise<boolean>
  usage?: any
}

export function ComposeColdEmailModal({
  onClose,
  onGenerate,
  onSend,
  usage,
}: ComposeColdEmailModalProps) {
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

  // Fetch AI-driven suggestions when job title changes
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
          tone?: 'professional' | 'tldr' | 'casual' | 'formal' | 'enthusiastic' | 'confident'
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
                        if (file.size > 5 * 1024 * 1024) {
                          setError('Resume file too large. Please choose a file under 5MB.')
                          return
                        }
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
                <label className="block text-xs text-neutral-500 mb-1">Why you're a fit (optional)</label>
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
                    {paymentId && (
                      <>
                        <option value="casual">Casual & Friendly</option>
                        <option value="formal">Formal & Executive</option>
                        <option value="enthusiastic">Enthusiastic & Energetic</option>
                        <option value="confident">Confident & Direct</option>
                      </>
                    )}
                  </select>
                  {!paymentId && (
                    <div className="mt-1 text-[10px] text-neutral-500">
                      💎 Unlock 4 more tone options with payment
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
                {!paymentId && (!usage || usage.remainingFreeGenerations === 0) ? (
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
                        import('sonner').then(({ toast }) => toast.success('Draft generated'))
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


import GradientBackground from '../components/GradientBackground'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { FcGoogle } from 'react-icons/fc'
import { PointerHighlight } from '../components/ui/pointer-highlight'
import { FlipWords } from '../components/flipwords'
import { useEffect, useMemo, useState } from 'react'
import { Check, Mail, Sparkles, FileText, Lock, Zap, Infinity } from 'lucide-react'

const API_BASE = import.meta.env.PROD ? '' : ((import.meta.env.VITE_API_BASE as string) || 'http://localhost:4000')

type Props = { onLoggedIn?: () => void }

export default function Hero({ onLoggedIn }: Props) {
  // Slideshow configuration
  const slides = useMemo(
    () => [
      {
        src: new URL('../images/coldemail.png', import.meta.url).toString(),
        alt: 'AI-powered cold email generation',
        title: 'AI Cold Email Mastery',
        description: 'Generate high-converting cold emails with advanced AI. Smart personalization, A/B testing, and automated follow-ups that actually get responses.',
      },
      {
        src: new URL('../images/ai chat.jpg', import.meta.url).toString(),
        alt: 'Intelligent inbox management',
        title: 'Smart Inbox Intelligence',
        description: 'AI-powered email triage, instant summaries, and intelligent categorization. Your inbox becomes a productivity powerhouse.',
      },
      {
        src: new URL('../images/chigma.png', import.meta.url).toString(),
        alt: 'Advanced email features and automation',
        title: 'Next-Gen Email Features',
        description: 'OTP detection, smart delete suggestions, automated responses, and seamless Gmail integration. Email management reimagined.',
      },
    ],
    []
  )
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    if (isPaused || slides.length === 0) return
    const id = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slides.length)
    }, 8000) // ample time to read
    return () => clearInterval(id)
  }, [isPaused, slides.length])

  function goTo(index: number) {
    setCurrentSlideIndex((index + slides.length) % slides.length)
  }
  function next() {
    goTo(currentSlideIndex + 1)
  }
  function prev() {
    goTo(currentSlideIndex - 1)
  }
  async function startGoogleAuth() {
    try {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
      if (!clientId) throw new Error('Missing VITE_GOOGLE_CLIENT_ID')

      // Ensure Google script is ready
      function ensure() {
        return new Promise<void>((resolve) => {
          if ((window as any).google?.accounts?.oauth2) return resolve()
          const id = setInterval(() => {
            if ((window as any).google?.accounts?.oauth2) {
              clearInterval(id)
              resolve()
            }
          }, 50)
        })
      }
      await ensure()
      const codeClient = (window as any).google.accounts.oauth2.initCodeClient({
        client_id: clientId,
        scope: 'openid email https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send',
        ux_mode: 'popup',
        callback: async (resp: any) => {
          if (resp.error) return
          const r = await fetch(`${API_BASE}/api/auth/google`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: resp.code }),
          })
          if (r.ok) onLoggedIn?.()
        },
      })
      codeClient.requestCode()
    } catch (e) {
      console.error(e)
      import('sonner').then(({ toast }) => toast.error('Failed to start Google sign in'))
    }
  }

  async function startMicrosoftAuth() {
    try {
      const response = await fetch(`${API_BASE}/api/auth/microsoft/login`, {
        method: 'GET',
        credentials: 'include',
      })
      
      if (!response.ok) {
        throw new Error('Failed to initiate Microsoft login')
      }
      
      const { authUrl } = await response.json()
      
      const width = 500
      const height = 600
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2
      
      const popup = window.open(
        authUrl,
        'Microsoft Login',
        `width=${width},height=${height},left=${left},top=${top}`
      )
      
      const handleMessage = async (event: MessageEvent) => {
        if (event.data?.type === 'microsoft-oauth-success') {
          const { code } = event.data
          
          const authResponse = await fetch(`${API_BASE}/api/auth/microsoft/callback`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          })
          
          if (!authResponse.ok) {
            throw new Error('Failed to authenticate with Microsoft')
          }
          
          window.removeEventListener('message', handleMessage)
          popup?.close()
          onLoggedIn?.()
        }
      }
      
      window.addEventListener('message', handleMessage)
      
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed)
          window.removeEventListener('message', handleMessage)
        }
      }, 500)
      
    } catch (e) {
      console.error(e)
      import('sonner').then(({ toast }) => toast.error('Failed to start Microsoft sign in'))
    }
  }
  return (
    <GradientBackground>
      {/* Top sticky banner */}
      {/* Removed in-app banner to avoid duplicate; base index.html contains a static privacy banner for reviewers */}
      {/* Hero headline */}
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-10 text-center">
        <h1 className="font-bold tracking-tight text-neutral-100 text-4xl md:text-6xl leading-tight">
          AI Powered Email,
          <br className="hidden md:block" />
          <span className="block mt-2">
            Built to{' '}
            <PointerHighlight>
              <FlipWords words={[
                'Save You Time',
                'Manage Better',
                'Reply Faster',
                'Clear Your Inbox',
              ]} />
            </PointerHighlight>
          </span>
        </h1>
        <p className="mt-4 text-neutral-400 max-w-3xl mx-auto">
          Invoxus is an AI‑native email client that manages your inbox, so you don't have to.
        </p>

        {/* Sign in CTA */}
        <div className="mt-8 flex flex-col items-center justify-center gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={startGoogleAuth}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950/60 hover:bg-neutral-900 px-4 py-2 text-sm text-neutral-100"
            >
              <FcGoogle className="h-5 w-5" />
              Sign in with Google
            </button>
            <button
              onClick={startMicrosoftAuth}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950/60 hover:bg-neutral-900 px-4 py-2 text-sm text-neutral-100"
            >
              <svg width="20" height="20" viewBox="0 0 23 23" fill="none">
                <rect x="0" y="0" width="11" height="11" fill="#f25022"/>
                <rect x="12" y="0" width="11" height="11" fill="#7fba00"/>
                <rect x="0" y="12" width="11" height="11" fill="#00a4ef"/>
                <rect x="12" y="12" width="11" height="11" fill="#ffb900"/>
              </svg>
              Sign in with Outlook
            </button>
          </div>
          <a
            href={(import.meta.env.VITE_GITHUB_REPO_URL as string | undefined) || 'https://github.com/abduwu8/invoxus'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950/40 hover:bg-neutral-900 px-4 py-2 text-sm text-neutral-100"
            aria-label="Star the repository on GitHub"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.42c.58.11.79-.25.79-.56v-2c-3.22.7-3.9-1.38-3.9-1.38-.53-1.35-1.3-1.71-1.3-1.71-1.06-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.72 1.27 3.39.97.11-.76.41-1.27.74-1.56-2.57-.29-5.28-1.29-5.28-5.73 0-1.27.46-2.31 1.2-3.13-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.2a10.97 10.97 0 0 1 5.78 0c2.2-1.51 3.17-1.2 3.17-1.2.63 1.59.23 2.76.11 3.05.75.82 1.2 1.86 1.2 3.13 0 4.45-2.71 5.44-5.29 5.72.42.36.79 1.06.79 2.13v3.16c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .5Z"/>
            </svg>
            Star on GitHub
          </a>
        </div>
        
        {/* Privacy Policy Notice */}
        <div className="mt-4 text-center">
          <p className="text-neutral-400 text-xs">
            By signing in, you agree to our{' '}
            <a
              href="https://invoxus.email/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-300 hover:text-neutral-100 underline transition-colors"
            >
              Privacy Policy
            </a>
          </p>
        </div>
      </section>

      {/* Bottom showcase placeholder (replace with your image later) */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="relative">
          {/* Clean vertical lines OUTSIDE the image frame */}
          <div className="pointer-events-none absolute inset-y-0 left-[-16px] w-px bg-neutral-800/80" />
          <div className="pointer-events-none absolute inset-y-0 right-[-16px] w-px bg-neutral-800/80" />
          {/* Clean horizontal line above the image frame (full-bleed across viewport) */}
          <div className="pointer-events-none absolute top-[-16px] left-1/2 -translate-x-1/2 w-full h-px bg-neutral-800/80" />
          {/* Video frame */}
          <div className="relative rounded-2xl border border-neutral-800 overflow-hidden">
            {/* Mobile video */}
            <video
              src={new URL('../images/InvoxusPromoMobile.mp4', import.meta.url).toString()}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-auto block md:hidden"
            />
            {/* Desktop video */}
            <video
              src={new URL('../images/InvoxusPromo.mp4', import.meta.url).toString()}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-auto hidden md:block"
            />
          </div>
        </div>
      </section>

      {/* Speed page section below hero */}
      <section className="mx-auto max-w-6xl px-6 pt-16 md:pt-24 pb-10 text-center">
        <p className="text-neutral-400 text-sm">Made to ensure you never have to waste time</p>
        <h2 className="mt-2 font-bold tracking-tight text-neutral-100 text-5xl md:text-7xl leading-tight">
          Speed Is Everything
        </h2>
        <p className="mt-4 text-3xl text-neutral-400 max-w-3xl mx-auto">
          And we promise to keep it that way.
        </p>
      </section>

      {/* Clean image background + text overlay instead of cards */}
      <section className="mx-auto max-w-6xl px-6 pb-10 md:pb-14">
        <div className="relative overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950/40 min-h-[420px] md:min-h-[560px] lg:min-h-[640px]">
          <img
            src={new URL('../images/curve-modified.png', import.meta.url).toString()}
            alt="Why Invoxus background"
            className="absolute top-[200px] h-full w-full object-contain object-center opacity-80"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/60" />
          <div className="relative p-6 md:p-10 lg:p-14">
            <h3 className="text-neutral-100 text-2xl md:text-4xl font-semibold">Built for speed and clarity</h3>
            <p className="mt-3 text-neutral-300 text-sm md:text-base max-w-3xl">
              Keyboard‑first navigation, instant summaries, and an OTP hub so the important stuff is always one glance away.
              Clean, fast, and focused on getting you through email in minutes.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16 md:pb-24">
        <div className="relative">
          {/* Image frame (same visual weight as the template card) */}
          <div className="relative rounded-2xl border border-neutral-800 overflow-hidden bg-neutral-950/70">
            <div className="h-[440px] w-full grid place-items-center text-neutral-500">
              <video
                src={new URL('../images/video.mp4', import.meta.url).toString()}
                autoPlay
                muted
                loop
                playsInline
                className="max-w-full max-h-full object-contain object-center"
              />
            </div>
            {/* Full overlay across the whole video with centered text */}
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/70">
              <div className="flex items-center justify-center text-center px-4">
                <div className="text-neutral-100 text-xl md:text-4xl font-semibold">
                  <FlipWords words={[
                    'Reply in seconds',
                    'Manage your mails in one click',
                    'Clear your inbox in seconds',
                  ]} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Slideshow intro */}
      <section className="mx-auto max-w-6xl px-6 pt-16 md:pt-24 pb-8 md:pb-10 text-center">
        <h3 className="font-bold tracking-tight text-neutral-100 text-3xl md:text-5xl">Why Invoxus?</h3>
      </section>

      {/* Slideshow section below features */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="relative">
          {/* Clean vertical lines OUTSIDE the frame */}
          <div className="pointer-events-none absolute inset-y-0 left-[-16px] w-px bg-neutral-800/80" />
          <div className="pointer-events-none absolute inset-y-0 right-[-16px] w-px bg-neutral-800/80" />
          <div className="pointer-events-none absolute top-[-16px] left-1/2 -translate-x-1/2 w-full h-px bg-neutral-800/80" />

          <div
            className="relative rounded-2xl border border-neutral-800 overflow-hidden bg-neutral-900/40 h-[420px] md:h-[520px]"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {/* Images crossfade */}
            <div className="absolute inset-0">
              {slides.map((s, idx) => (
                <img
                  key={s.src}
                  src={s.src}
                  alt={s.alt}
                  className="absolute inset-0 w-full h-full object-contain object-center transition-opacity duration-700 ease-in-out"
                  style={{ opacity: idx === currentSlideIndex ? 1 : 0 }}
                  loading={idx === currentSlideIndex ? 'eager' : 'lazy'}
                />
              ))}
            </div>

            {/* Caption with gradient and crossfade */}
            <div className="absolute inset-x-0 bottom-0">
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 md:h-40 bg-gradient-to-t from-black via-black/80 to-transparent" />
              <div className="relative p-4 md:p-6">
                {slides.map((s, idx) => (
                  <div
                    key={s.title}
                    className={`absolute inset-x-0 bottom-0 px-4 md:px-6 pb-4 md:pb-6 transition-opacity duration-500 ease-in-out ${idx === currentSlideIndex ? 'opacity-100' : 'opacity-0'}`}
                  >
                    <h3 className="text-white text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent drop-shadow-lg">{s.title}</h3>
                    <p className="mt-1 text-neutral-300 text-sm md:text-base max-w-3xl">{s.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2 md:px-3">
              <button
                type="button"
                aria-label="Previous"
                onClick={prev}
                className="rounded-full bg-black/50 hover:bg-black/70 text-neutral-100 p-2 backdrop-blur-sm border border-white/10"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M12.78 4.22a.75.75 0 0 1 0 1.06L8.06 10l4.72 4.72a.75.75 0 1 1-1.06 1.06l-5.25-5.25a.75.75 0 0 1 0-1.06l5.25-5.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd"/></svg>
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={next}
                className="rounded-full bg-black/50 hover:bg-black/70 text-neutral-100 p-2 backdrop-blur-sm border border-white/10"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" style={{ transform: 'scaleX(-1)' }}><path fillRule="evenodd" d="M12.78 4.22a.75.75 0 0 1 0 1.06L8.06 10l4.72 4.72a.75.75 0 1 1-1.06 1.06l-5.25-5.25a.75.75 0 0 1 0-1.06l5.25-5.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd"/></svg>
              </button>
            </div>

            {/* Indicators */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  aria-label={`Go to slide ${idx + 1}`}
                  className={`h-2.5 w-2.5 rounded-full border border-white/20 ${idx === currentSlideIndex ? 'bg-white/90' : 'bg-white/30 hover:bg-white/50'}`}
                  onClick={() => goTo(idx)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing & Trial Information Section */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="text-center mb-16">
          <h2 className="font-bold tracking-tight text-white text-3xl md:text-5xl mb-3">
            Simple Pricing
          </h2>
          <p className="text-neutral-400 text-base max-w-xl mx-auto">
            Start free. Pay only when you need more.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* Free Trial Card */}
          <div className="relative rounded-xl border border-neutral-800/50 bg-neutral-900/30 p-8 backdrop-blur-sm">
            <div className="mb-8">
              <div className="text-sm text-neutral-400 mb-2">Free Trial</div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-5xl font-bold text-white">₹0</span>
                <span className="text-neutral-500">/ 5 emails</span>
              </div>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <Mail className="w-5 h-5 text-white/70" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <div className="text-neutral-200 text-sm">5 AI-generated emails</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <Zap className="w-5 h-5 text-white/70" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <div className="text-neutral-200 text-sm">2 tone options</div>
                  <div className="text-neutral-500 text-xs mt-0.5">Professional & TL;DR</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <FileText className="w-5 h-5 text-white/70" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <div className="text-neutral-200 text-sm">Resume attachment</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <Check className="w-5 h-5 text-white/70" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <div className="text-neutral-200 text-sm">Full email management</div>
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t border-neutral-800/50">
              <div className="text-xs text-neutral-500 text-center">No credit card required</div>
            </div>
          </div>

          {/* Paid Plan Card */}
          <div className="relative rounded-xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
            <div className="absolute top-4 right-4">
              <div className="px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm">
                <span className="text-xs font-medium text-white/90">Popular</span>
              </div>
            </div>
            
            <div className="mb-8">
              <div className="text-sm text-neutral-400 mb-2">Pay Per Use</div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-5xl font-bold text-white">₹1</span>
                <span className="text-neutral-500">/ email</span>
              </div>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <Infinity className="w-5 h-5 text-white/90" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <div className="text-white text-sm font-medium">Unlimited emails</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <Sparkles className="w-5 h-5 text-white/90" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <div className="text-white text-sm font-medium">6 AI tone options</div>
                  <div className="text-neutral-400 text-xs mt-0.5">Casual, Formal, Enthusiastic, Confident + more</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <FileText className="w-5 h-5 text-white/90" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <div className="text-white text-sm font-medium">Resume attachment</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <Lock className="w-5 h-5 text-white/90" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <div className="text-white text-sm font-medium">Secure payments</div>
                  <div className="text-neutral-400 text-xs mt-0.5">Razorpay integration</div>
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t border-white/10">
              <div className="text-xs text-neutral-400 text-center">Pay only when you generate</div>
            </div>
          </div>
        </div>

        {/* Simple Benefits Bar */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-neutral-400">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-white/50" strokeWidth={2} />
            <span>No subscriptions</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-white/50" strokeWidth={2} />
            <span>Cancel anytime</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-white/50" strokeWidth={2} />
            <span>Instant access</span>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="mx-auto max-w-7xl px-6 py-20 md:py-32">
        <div className="text-center mb-16">
          <h2 className="font-bold tracking-tight text-neutral-100 text-4xl md:text-6xl mb-6">
            Trusted by Professionals
          </h2>
          <p className="text-neutral-400 text-lg md:text-xl max-w-3xl mx-auto">
            Here's what HR leaders and professionals have to say
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {/* Testimonial 1 - Nikhat Jahan */}
          <div className="relative rounded-2xl border border-neutral-800 bg-neutral-950/60 p-8 hover:border-neutral-700 transition-all">
            {/* Profile Section */}
            <div className="flex items-start gap-4 mb-6">
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                  NJ
                </div>
                {/* LinkedIn badge */}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded bg-[#0A66C2] flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-neutral-100 font-semibold text-base mb-0.5">Nikhat Jahan</h4>
                <p className="text-neutral-400 text-sm">Senior HR</p>
                <p className="text-neutral-500 text-xs">RK SWAMY</p>
              </div>
            </div>
            
            {/* Testimonial Text */}
            <p className="text-neutral-300 text-sm leading-relaxed">
              "Invoxus has transformed how we manage candidate communications. The AI-powered email generation saves us hours every week, and the smart inbox features help us never miss important applications. A must-have tool for any HR team."
            </p>
          </div>

          {/* Testimonial 2 - Priya Sharma */}
          <div className="relative rounded-2xl border border-neutral-800 bg-neutral-950/60 p-8 hover:border-neutral-700 transition-all">
            {/* Profile Section */}
            <div className="flex items-start gap-4 mb-6">
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-white font-bold text-xl">
                  PS
                </div>
                {/* LinkedIn badge */}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded bg-[#0A66C2] flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-neutral-100 font-semibold text-base mb-0.5">Priya Sharma</h4>
                <p className="text-neutral-400 text-sm">Talent Acquisition Lead</p>
                <p className="text-neutral-500 text-xs">Tech Mahindra</p>
              </div>
            </div>
            
            {/* Testimonial Text */}
            <p className="text-neutral-300 text-sm leading-relaxed">
              "The bulk email management and smart categorization features are game-changers. We process hundreds of applications daily, and Invoxus helps us stay organized and respond faster. The ROI is incredible for the price."
            </p>
          </div>

          {/* Testimonial 3 - Rajesh Kumar */}
          <div className="relative rounded-2xl border border-neutral-800 bg-neutral-950/60 p-8 hover:border-neutral-700 transition-all">
            {/* Profile Section */}
            <div className="flex items-start gap-4 mb-6">
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white font-bold text-xl">
                  RK
                </div>
                {/* LinkedIn badge */}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded bg-[#0A66C2] flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-neutral-100 font-semibold text-base mb-0.5">Rajesh Kumar</h4>
                <p className="text-neutral-400 text-sm">HR Manager</p>
                <p className="text-neutral-500 text-xs">Infosys</p>
              </div>
            </div>
            
            {/* Testimonial Text */}
            <p className="text-neutral-300 text-sm leading-relaxed">
              "As someone who sends dozens of emails daily, Invoxus has been a productivity booster. The AI assistant understands context well, and the email templates save us so much time. Highly recommend for any HR professional."
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA section with aurora gradient background */}
      <section className="relative w-full min-h-screen overflow-hidden">
        {/* Aurora Dream Vivid Bloom */}
        <div
          className="absolute inset-0 z-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 70% 20%, rgba(175, 109, 255, 0.85), transparent 68%),
              radial-gradient(ellipse 70% 60% at 20% 80%, rgba(255, 100, 180, 0.75), transparent 68%),
              radial-gradient(ellipse 60% 50% at 60% 65%, rgba(255, 235, 170, 0.98), transparent 68%),
              radial-gradient(ellipse 65% 40% at 50% 60%, rgba(120, 190, 255, 0.3), transparent 68%),
              linear-gradient(180deg, #f7eaff 0%, #fde2ea 100%)
            `,
          }}
        />
        {/* Heavy top fade for contrast */}
        <div className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-b from-black/90 via-black/60 to-transparent" />
        <div className="absolute top-0 left-0 right-0 z-0 pointer-events-none h-[60%] md:h-[65%] lg:h-[70%] bg-gradient-to-b from-black/95 via-black/90 to-transparent" />
        {/* Content */}
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 sm:py-28 lg:py-36 text-center">
          <h2 className="font-extrabold tracking-tight text-neutral-100/80 text-4xl sm:text-6xl md:text-7xl lg:text-8xl leading-tight break-keep" style={{ hyphens: 'none' }}>
          Revolutionizing the Way You Email
          </h2>
          <p className="mt-6 text-neutral-100/70 text-lg sm:text-xl md:text-2xl max-w-4xl mx-auto">
          Streamline your inbox in minutes, not hours with Invoxus.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={startGoogleAuth}
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950/70 hover:bg-neutral-900 px-5 py-2.5 text-sm sm:text-base text-neutral-100 shadow-sm"
              >
                <FcGoogle className="h-5 w-5" />
                Get Started with Google
              </button>
              <button
                onClick={startMicrosoftAuth}
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950/70 hover:bg-neutral-900 px-5 py-2.5 text-sm sm:text-base text-neutral-100 shadow-sm"
              >
                <svg width="20" height="20" viewBox="0 0 23 23" fill="none">
                  <rect x="0" y="0" width="11" height="11" fill="#f25022"/>
                  <rect x="12" y="0" width="11" height="11" fill="#7fba00"/>
                  <rect x="0" y="12" width="11" height="11" fill="#00a4ef"/>
                  <rect x="12" y="12" width="11" height="11" fill="#ffb900"/>
                </svg>
                Get Started with Outlook
              </button>
            </div>
            <p className="text-neutral-100/60 text-xs">
              By getting started, you agree to our{' '}
              <a
                href="https://invoxus.email/privacy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-100/80 hover:text-neutral-100 underline transition-colors"
              >
                Privacy Policy
              </a>
            </p>
          </div>
        </div>
        {/* Bottom social icons and legal links over gradient */}
        <div className="absolute inset-x-0 bottom-6 z-10 flex flex-col items-center justify-center gap-4">
          <nav aria-label="Social links" className="flex items-center gap-6">
            {/* GitHub */}
            <a
              href="https://github.com/abduwu8"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="text-black opacity-90 hover:opacity-100 transition-opacity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.42c.58.11.79-.25.79-.56v-2c-3.22.7-3.9-1.38-3.9-1.38-.53-1.35-1.3-1.71-1.3-1.71-1.06-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.72 1.27 3.39.97.11-.76.41-1.27.74-1.56-2.57-.29-5.28-1.29-5.28-5.73 0-1.27.46-2.31 1.2-3.13-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.2a10.97 10.97 0 0 1 5.78 0c2.2-1.51 3.17-1.2 3.17-1.2.63 1.59.23 2.76.11 3.05.75.82 1.2 1.86 1.2 3.13 0 4.45-2.71 5.44-5.29 5.72.42.36.79 1.06.79 2.13v3.16c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .5Z"/>
              </svg>
            </a>
            {/* LinkedIn */}
            <a
              href="https://www.linkedin.com/in/abdullahkhannn"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="text-black opacity-90 hover:opacity-100 transition-opacity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M20.45 20.45h-3.55v-5.59c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.95v5.68H9.37V9h3.41v1.56h.05c.47-.89 1.62-1.85 3.34-1.85 3.57 0 4.23 2.35 4.23 5.4v6.34ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM3.56 20.45h3.55V9H3.56v11.45Z"/>
              </svg>
            </a>
            {/* Mail */}
            <a
              href="mailto:abdullahabdukhan@gmail.com"
              aria-label="Email"
              className="text-black opacity-90 hover:opacity-100 transition-opacity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 2v.01L12 13 4 6.01V6h16ZM4 18V8.24l7.4 6.29a1 1 0 0 0 1.2 0L20 8.24V18H4Z"/>
              </svg>
            </a>
          </nav>
          
          {/* Legal links */}
          <nav aria-label="Legal links" className="flex items-center gap-4 text-sm">
            <a
              href="https://invoxus.email/privacy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-black opacity-70 hover:opacity-100 transition-opacity underline"
            >
              Privacy Policy
            </a>
            <span className="text-black opacity-50">•</span>
            <a
              href="mailto:contact@invoxus.email"
              className="text-black opacity-70 hover:opacity-100 transition-opacity underline"
            >
              Contact
            </a>
          </nav>
        </div>
      </section>
    </GradientBackground>
  )
}

// Removed unused helper components after switching to an image placeholder



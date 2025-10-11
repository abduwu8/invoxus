import GradientBackground from '../components/GradientBackground'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { FcGoogle } from 'react-icons/fc'
import { PointerHighlight } from '../components/ui/pointer-highlight'
import { FlipWords } from '../components/flipwords'
import { useEffect, useMemo, useState } from 'react'

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
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={startGoogleAuth}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950/60 hover:bg-neutral-900 px-4 py-2 text-sm text-neutral-100"
          >
            <FcGoogle className="h-5 w-5" />
            Sign in with Google
          </button>
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
          {/* Image frame */}
          <div className="relative rounded-2xl border border-neutral-800 overflow-hidden">
            <img
              src={new URL('../images/Screenshot 2025-08-10 182210.png', import.meta.url).toString()}
              alt="App preview"
              className="w-full h-auto block"
              loading="eager"
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

      <section className="mx-auto max-w-4xl px-6 pb-24 mt-10 md:mt-24 mb-10 md:mb-16">
        <div className="relative">
          {/* Clean vertical lines outside the frame */}
          <div className="pointer-events-none absolute inset-y-0 left-[-16px] w-px bg-neutral-800/80" />
          <div className="pointer-events-none absolute inset-y-0 right-[-16px] w-px bg-neutral-800/80" />
          {/* Clean horizontal line above the frame */}
          <div className="pointer-events-none absolute top-[-16px] left-1/2 -translate-x-1/2 w-full h-px bg-neutral-800/80" />
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
              <div className="flex items-center gap-2 text-neutral-100 text-xl md:text-4xl font-semibold">
                
                <FlipWords words={[
                  'Reply in seconds',
                  'Manage your mails in one click',
                  'Clear your inbox in seconds',
                ]} />
              </div>
            </div>
          </div>
        </div>
      </section>

      

      {/* Slideshow intro */}
      <section className="mx-auto max-w-6xl px-6 pt-8 md:pt-12 pb-8 md:pb-10 text-center">
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
        <div className="text-center mb-12">
          <h2 className="font-bold tracking-tight text-neutral-100 text-3xl md:text-5xl mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
            Start with 5 free AI-powered cold emails. No hidden fees, no subscriptions.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Trial Card */}
          <div className="relative rounded-2xl border border-neutral-800 bg-neutral-950/60 p-8">
            <div className="absolute top-4 right-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-900/30 text-green-400 border border-green-800/50">
                Free Trial
              </span>
            </div>
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-neutral-100 mb-2">Free Trial</h3>
              <div className="flex items-baseline">
                <span className="text-4xl font-bold text-green-400">₹0</span>
                <span className="text-neutral-400 ml-2">for 5 emails</span>
              </div>
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center text-neutral-300">
                <svg className="w-5 h-5 text-green-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                5 AI-generated cold emails
              </li>
              <li className="flex items-center text-neutral-300">
                <svg className="w-5 h-5 text-green-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Professional & TLDR tone options
              </li>
              <li className="flex items-center text-neutral-300">
                <svg className="w-5 h-5 text-green-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Resume attachment support
              </li>
              <li className="flex items-center text-neutral-300">
                <svg className="w-5 h-5 text-green-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Full email management features
              </li>
            </ul>
            <div className="text-center">
              <span className="text-sm text-neutral-400">No credit card required</span>
            </div>
          </div>

          {/* Paid Plan Card */}
          <div className="relative rounded-2xl border border-blue-800/50 bg-gradient-to-br from-blue-950/30 to-purple-950/30 p-8">
            <div className="absolute top-4 right-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-900/30 text-blue-400 border border-blue-800/50">
                After Trial
              </span>
            </div>
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-neutral-100 mb-2">Pay Per Email</h3>
              <div className="flex items-baseline">
                <span className="text-4xl font-bold text-blue-400">₹1</span>
                <span className="text-neutral-400 ml-2">per email</span>
              </div>
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center text-neutral-300">
                <svg className="w-5 h-5 text-blue-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                AI-generated cold emails
              </li>
              <li className="flex items-center text-neutral-300">
                <svg className="w-5 h-5 text-blue-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                All tone and style options
              </li>
              <li className="flex items-center text-neutral-300">
                <svg className="w-5 h-5 text-blue-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Resume attachment support
              </li>
              <li className="flex items-center text-neutral-300">
                <svg className="w-5 h-5 text-blue-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Secure payment via Razorpay
              </li>
            </ul>
            <div className="text-center">
              <span className="text-sm text-neutral-400">Pay only when you use</span>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-6 text-sm text-neutral-400">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              No subscriptions
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Cancel anytime
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Secure payments
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-16">
          <h3 className="text-2xl font-bold text-neutral-100 text-center mb-8">How It Works</h3>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-lg">1</span>
              </div>
              <h4 className="text-lg font-semibold text-neutral-100 mb-2">Sign Up Free</h4>
              <p className="text-neutral-400 text-sm">Connect your Gmail account and get 5 free AI-generated cold emails instantly.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-lg">2</span>
              </div>
              <h4 className="text-lg font-semibold text-neutral-100 mb-2">Generate Emails</h4>
              <p className="text-neutral-400 text-sm">Use our AI to create personalized cold emails with your resume and preferences.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-lg">3</span>
              </div>
              <h4 className="text-lg font-semibold text-neutral-100 mb-2">Pay As You Go</h4>
              <p className="text-neutral-400 text-sm">After your free trial, pay only ₹1 per additional email. No hidden fees or subscriptions.</p>
            </div>
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
          Streamline your inbox in minutes, not hours—with Invoxus.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3">
            <button
              onClick={startGoogleAuth}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950/70 hover:bg-neutral-900 px-5 py-2.5 text-sm sm:text-base text-neutral-100 shadow-sm"
            >
              Get Started
            </button>
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



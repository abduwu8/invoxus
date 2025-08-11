import GradientBackground from '../components/GradientBackground'
import { Clock, Paperclip, Sparkles, SlidersHorizontal } from 'lucide-react'

export default function Speed() {
  return (
    <GradientBackground>
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-10 text-center">
        <p className="text-neutral-400 text-sm">Designed for power users who value time</p>
        <h1 className="mt-2 font-bold tracking-tight text-neutral-100 text-5xl md:text-7xl leading-tight">
          Speed Is Everything
        </h1>
        <h2 className="mt-2 text-neutral-500 text-3xl md:text-5xl font-semibold">Reply in seconds</h2>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 shadow-xl overflow-hidden">
          {/* To row */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800 text-sm">
            <span className="text-neutral-400 w-6 text-left">To:</span>
            <Chip name="Adam" color="bg-emerald-900/40 text-emerald-300" />
            <Chip name="Ryan" color="bg-indigo-900/40 text-indigo-300" />
          </div>

          {/* Subject */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800 text-sm text-neutral-300">
            <Clock className="size-4 text-neutral-500" />
            <span>Re: Code review feedback</span>
          </div>

          {/* Body */}
          <div className="px-4 py-4">
            <div className="rounded-xl bg-neutral-900/70 border border-neutral-800 p-4 text-sm text-neutral-200 text-left">
              <p className="mb-4">Hey team,</p>
              <p className="mb-4">
                I took a look at the code review feedback. Really like the keyboard navigation – it makes
                everything much faster to access. The search implementation is clean, though I'd love to
                see the link to test it out myself.
              </p>
              <p>
                Let me know when you can share the preview and I'll provide more detailed feedback.
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-t border-neutral-800">
            <Selector label="Send now" />
            <Button icon={<Paperclip className="size-4" />} label="Add files" />
            <Button icon={<Sparkles className="size-4" />} label="Neutral" />
            <Button icon={<SlidersHorizontal className="size-4" />} label="Medium-length" />
            <div className="ml-auto inline-flex items-center gap-2 text-neutral-500 text-xs">
              <kbd className="rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.5">⌘⏎</kbd>
              return generation
            </div>
          </div>
        </div>

        {/* Placeholder below for an image/screenshot the user will provide */}
        <div className="mt-10 h-72 rounded-2xl border border-neutral-800 bg-neutral-950/40 grid place-items-center text-neutral-500">
          <div className="text-sm">Image placeholder – replace with your screenshot</div>
        </div>
      </section>
    </GradientBackground>
  )
}

function Chip({ name, color }: { name: string; color: string }) {
  const initial = name.charAt(0).toUpperCase()
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/60 px-2 py-1">
      <span className={`size-5 grid place-items-center rounded-full text-[10px] ${color} border border-neutral-800`}>{initial}</span>
      <span className="text-neutral-300 text-xs">{name}</span>
    </span>
  )
}

function Selector({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900/70 px-2.5 py-1.5 text-xs text-neutral-300">
      {label}
      <svg width="12" height="12" viewBox="0 0 24 24" className="opacity-60" aria-hidden>
        <path fill="currentColor" d="M7 10l5 5 5-5z" />
      </svg>
    </span>
  )
}

function Button({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900/70 px-2.5 py-1.5 text-xs text-neutral-300">
      {icon}
      {label}
    </span>
  )
}



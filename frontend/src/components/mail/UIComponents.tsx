import { Send, Wand2 } from 'lucide-react'
import { useState } from 'react'
import type { Email } from './types'

// Local type definitions
type Importance = 'high' | 'medium' | 'low'
type EmailListItem = Email & { unread?: boolean }

// Avatar Component
export function Avatar({ from, unread }: { from: string; unread?: boolean }) {
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

// Section Header
export function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-3 py-2 text-xs uppercase tracking-wide text-neutral-500 select-none">{title}</div>
  )
}

// Email List Row
export function EmailListRow({
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

// Icon Button
export function IconButton({
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

// Importance Badge
export function ImportanceBadge({ level }: { level: Importance }) {
  const color =
    level === 'high' ? 'bg-amber-500/20 text-amber-300 border-amber-600/40' : level === 'medium' ? 'bg-neutral-800 text-neutral-300 border-neutral-700' : 'bg-neutral-900 text-neutral-400 border-neutral-800'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${color}`}>
      {level.toUpperCase()}
    </span>
  )
}

// Skeleton Components
export function SkeletonRow() {
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

export function DetailSkeleton() {
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

// Email HTML Frame
export function EmailHtmlFrame({ html }: { html: string }) {
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

// Reply Box
export function ReplyBox({ onSend, onSuggest }: { onSend: (text: string) => Promise<void>; onSuggest?: () => Promise<string> }) {
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

// Summary Card
export function SummaryCard({
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


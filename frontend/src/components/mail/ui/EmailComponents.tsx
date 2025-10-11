import { CheckSquare } from 'lucide-react'

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

// Section Header Component
export function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-3 py-2 text-xs uppercase tracking-wide text-neutral-500 select-none">{title}</div>
  )
}

// Email List Row Component
type EmailListItem = {
  id: string
  threadId: string
  subject: string
  from: string
  date: string
  snippet: string
  unread?: boolean
  isStarred?: boolean
}

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

// Skeleton Components
export function SkeletonRow() {
  return (
    <li className="p-3 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="size-7 rounded-full bg-neutral-800" />
        <div className="h-4 w-48 bg-neutral-800 rounded" />
      </div>
      <div className="h-3 w-32 bg-neutral-800 rounded mt-2" />
      <div className="h-3 w-full bg-neutral-800 rounded mt-1" />
    </li>
  )
}

export function DetailSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-6 w-3/4 bg-neutral-800 rounded" />
      <div className="flex items-center gap-2">
        <div className="size-10 rounded-full bg-neutral-800" />
        <div>
          <div className="h-4 w-32 bg-neutral-800 rounded" />
          <div className="h-3 w-24 bg-neutral-800 rounded mt-1" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full bg-neutral-800 rounded" />
        <div className="h-3 w-full bg-neutral-800 rounded" />
        <div className="h-3 w-3/4 bg-neutral-800 rounded" />
      </div>
    </div>
  )
}

// Icon Button Component
export function IconButton({
  icon: Icon,
  label,
  onClick,
  active,
  disabled,
}: {
  icon: any
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-neutral-800 disabled:opacity-50 ${active ? 'bg-neutral-800' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      <Icon className="size-4" />
      <span className="hidden md:inline">{label}</span>
    </button>
  )
}

// Importance Badge Component
type Importance = 'high' | 'medium' | 'low'

export function ImportanceBadge({ level }: { level: Importance }) {
  const colors = {
    high: 'bg-red-900/30 text-red-300 border-red-700/40',
    medium: 'bg-amber-900/30 text-amber-300 border-amber-700/40',
    low: 'bg-green-900/30 text-green-300 border-green-700/40',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${colors[level]}`}>
      <CheckSquare className="size-3" />
      {level}
    </span>
  )
}

// Summary Card Component
export function SummaryCard({
  summary,
  expanded,
  onToggle,
}: {
  summary: string
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="rounded-lg border border-blue-900/40 bg-blue-950/20 p-3">
      <button
        className="w-full flex items-center justify-between text-left text-sm font-medium text-blue-300"
        onClick={onToggle}
      >
        <span>AI Summary</span>
        <svg
          className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded ? <div className="mt-2 text-sm text-blue-200">{summary}</div> : null}
    </div>
  )
}

// HTML Sanitization and Frame Component
export function sanitizeHtmlForDark(html: string): string {
  let clean = html
    .replace(/color:\s*#000000/gi, 'color: #e5e5e5')
    .replace(/color:\s*black/gi, 'color: #e5e5e5')
    .replace(/background-color:\s*#ffffff/gi, 'background-color: transparent')
    .replace(/background-color:\s*white/gi, 'background-color: transparent')
    .replace(/background:\s*#ffffff/gi, 'background: transparent')
    .replace(/background:\s*white/gi, 'background: transparent')
  return clean
}

export function EmailHtmlFrame({ html }: { html: string }) {
  const sanitized = sanitizeHtmlForDark(html)
  return (
    <iframe
      srcDoc={sanitized}
      sandbox="allow-same-origin"
      className="w-full min-h-[400px] border-0 bg-transparent"
      title="Email content"
    />
  )
}


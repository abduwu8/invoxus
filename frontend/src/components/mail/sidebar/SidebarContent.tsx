import { Inbox, Send, Archive, Trash2, Star, Tag, Sparkles, MessageSquare, X } from 'lucide-react'
import { ProfileHeader } from './ProfileHeader'
import { CategoryManager } from './CategoryManager'
import type { UserProfile } from '../types'

type SidebarContentProps = {
  profile: UserProfile | null
  selectedView: string
  onViewChange: (view: string) => void
  unreadCount: number
  categories: string[]
  onAddCategory: (name: string) => void
  onRemoveCategory: (name: string) => void
  onNewColdEmail: () => void
  onOpenChat: () => void
  onCloseSidebar?: () => void
  isMobile?: boolean
}

export function SidebarContent({
  profile,
  selectedView,
  onViewChange,
  unreadCount,
  categories,
  onAddCategory,
  onRemoveCategory,
  onNewColdEmail,
  onOpenChat,
  onCloseSidebar,
  isMobile = false,
}: SidebarContentProps) {
  const views = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, badge: unreadCount },
    { id: 'sent', label: 'Sent', icon: Send },
    { id: 'starred', label: 'Starred', icon: Star },
    { id: 'archive', label: 'Archive', icon: Archive },
    { id: 'trash', label: 'Trash', icon: Trash2 },
  ]

  return (
    <div className="flex flex-col h-full bg-neutral-950 border-r border-neutral-800">
      {/* Mobile close button */}
      {isMobile && onCloseSidebar && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <div className="text-sm font-semibold text-neutral-200">Menu</div>
          <button
            onClick={onCloseSidebar}
            className="size-8 grid place-items-center rounded hover:bg-neutral-900"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Profile Header */}
      <ProfileHeader profile={profile} />

      {/* Action Buttons */}
      <div className="px-2 py-3 space-y-2">
        <button
          className="w-full flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-2 text-sm font-medium transition-colors"
          onClick={() => {
            onNewColdEmail()
            if (isMobile && onCloseSidebar) onCloseSidebar()
          }}
        >
          <Sparkles className="size-4" />
          New Cold Email
        </button>
        <button
          className="w-full flex items-center gap-2 rounded-lg border border-neutral-800 hover:bg-neutral-900 px-3 py-2 text-sm font-medium transition-colors"
          onClick={() => {
            onOpenChat()
            if (isMobile && onCloseSidebar) onCloseSidebar()
          }}
        >
          <MessageSquare className="size-4" />
          AI Assistant
        </button>
      </div>

      {/* Navigation Views */}
      <nav className="px-2 py-2 space-y-0.5">
        {views.map((v) => {
          const Icon = v.icon
          const active = selectedView === v.id
          return (
            <button
              key={v.id}
              className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                active ? 'bg-neutral-900 font-medium' : 'hover:bg-neutral-900'
              }`}
              onClick={() => {
                onViewChange(v.id)
                if (isMobile && onCloseSidebar) onCloseSidebar()
              }}
            >
              <div className="flex items-center gap-2">
                <Icon className="size-4" />
                {v.label}
              </div>
              {v.badge ? (
                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium">
                  {v.badge}
                </span>
              ) : null}
            </button>
          )
        })}
      </nav>

      {/* Categories */}
      <div className="mt-auto border-t border-neutral-800 py-2">
        <CategoryManager
          categories={categories}
          onAdd={onAddCategory}
          onRemove={onRemoveCategory}
        />
      </div>
    </div>
  )
}


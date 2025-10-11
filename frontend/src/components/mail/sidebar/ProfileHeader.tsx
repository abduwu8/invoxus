import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { getInitial, API_BASE } from '../utils'
import type { UserProfile } from '../types'

type ProfileHeaderProps = {
  profile: UserProfile | null
}

export function ProfileHeader({ profile }: ProfileHeaderProps) {
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
        <svg className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.25a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clipRule="evenodd"/>
        </svg>
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


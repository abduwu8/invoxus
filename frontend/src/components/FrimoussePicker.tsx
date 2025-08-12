import  { useEffect, useRef, useState } from 'react'

type Props = {
  onPick: (emoji: string) => void
}

// Wrapper for the 'frimousse' EmojiPicker with safe dynamic import and click delegation.
export function FrimoussePicker({ onPick }: Props) {
  const [EmojiPicker, setEmojiPicker] = useState<any>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const mod = await import('frimousse')
        if (mounted) setEmojiPicker(() => mod.EmojiPicker)
      } catch {
        // keep null; caller can still use fallback styling
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  // Delegate click to capture selected emoji. Many pickers render the emoji as the button textContent.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (!t) return
      const btn = t.closest('button') as HTMLElement | null
      const glyph = (btn?.textContent || '').trim()
      if (glyph && glyph.length <= 4) {
        onPick(glyph)
      }
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [onPick])

  if (!EmojiPicker) {
    // Minimal fallback while module loads
    return (
      <div className="rounded-md border border-neutral-800 bg-neutral-950 shadow-xl w-[360px] max-w-[92vw] max-h-[50vh] overflow-y-auto p-1 grid grid-cols-8 gap-1 text-[20px]">
        {['😀','😁','😂','🤣','😊','🙂','😉','😍','😘','😇','🙏','👍','👎','🤝','👏','🙌','💪','🤔','😅','😌','🎉','✨','✅','❌','⚠️','🔥','💡','🚀','📌','📎','📅','📝','📞','💬','📨','📧','❤️','💙','💚','💛'].map((e, i) => (
          <button key={`${e}-${i}`} className="p-2 hover:bg-neutral-900 rounded" onClick={() => onPick(e)} aria-label={`Insert ${e}`}>{e}</button>
        ))}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="frimo rounded-md border border-neutral-800 bg-neutral-950 shadow-xl w-[360px] max-w-[92vw] max-h-[60vh] overflow-hidden relative z-[10001]">
      <style>
        {`
          /* Force a clean grid layout regardless of internal markup */
          .frimo [frimousse-list],
          .frimo [data-frimousse-list],
          .frimo [role='listbox'],
          .frimo [role='list'],
          .frimo ul {
            display: grid !important;
            grid-template-columns: repeat(8, minmax(0, 1fr)) !important;
            gap: 4px !important;
            padding: 4px !important;
          }
          .frimo .frimo-viewport > .frimo-grid {
            display: grid !important;
            grid-template-columns: repeat(8, minmax(0, 1fr)) !important;
            gap: 4px !important;
          }
          .frimo [frimousse-group],
          .frimo [data-frimousse-group],
          .frimo [role='group'] { display: contents !important; }
          .frimo [frimousse-group-name],
          .frimo [data-frimousse-group-name],
          .frimo [role='heading'],
          .frimo h3,
          .frimo h4 { display: none !important; }
          .frimo li { list-style: none !important; }
          .frimo button { width: 100%; aspect-ratio: 1/1; font-size: 22px; padding: 0; margin: 0; border-radius: 8px; display: grid; place-items: center; line-height: 1; }
          .frimo button:hover { background: rgba(255,255,255,0.06); }
        `}
      </style>
      <EmojiPicker.Root>
        <div className="border-b border-neutral-800 p-1">
          <EmojiPicker.Search className="w-full bg-transparent outline-none text-sm px-2 py-1 placeholder:text-neutral-500" placeholder="Search emoji" />
        </div>
        <EmojiPicker.Viewport className="frimo-viewport max-h-[55vh] overflow-auto">
          <EmojiPicker.Loading>
            <div className="p-2 text-xs text-neutral-500">Loading…</div>
          </EmojiPicker.Loading>
          <EmojiPicker.Empty>
            <div className="p-2 text-xs text-neutral-500">No emoji found.</div>
          </EmojiPicker.Empty>
          <div className="frimo-grid p-1">
            <EmojiPicker.List className="contents" />
          </div>
        </EmojiPicker.Viewport>
      </EmojiPicker.Root>
    </div>
  )
}



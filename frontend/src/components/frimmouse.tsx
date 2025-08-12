import React from 'react'

type Props = {
  onPick: (emoji: string) => void
  size?: 'sm' | 'md'
}

// Lightweight emoji grid "library" for this app
export function Frimmouse({ onPick, size = 'md' }: Props) {
  const emojis = React.useMemo(
    () => [
      '😀','😁','😂','🤣','😊','🙂','😉','😍','😘','😇',
      '🙏','👍','👎','🤝','👏','🙌','💪','🤔','😅','😌',
      '🎉','✨','✅','❌','⚠️','🔥','💡','🚀','📌','📎',
      '📅','📝','📞','💬','📨','📧','❤️','💙','💚','💛',
    ],
    []
  )

  const cell = size === 'sm' ? 'text-[18px] p-1.5' : 'text-[20px] p-2'

  return (
    <div
      className="rounded-md border border-neutral-800 bg-neutral-950 shadow-xl w-[320px] max-w-[92vw] max-h-[40vh] overflow-y-auto p-1"
      role="dialog"
      aria-label="Emoji picker"
    >
      <div className="grid grid-cols-8 gap-1">
        {emojis.map((e, i) => (
          <button
            key={`${e}-${i}`}
            type="button"
            className={`${cell} hover:bg-neutral-900 rounded`}
            onClick={() => onPick(e)}
            aria-label={`Insert ${e}`}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}



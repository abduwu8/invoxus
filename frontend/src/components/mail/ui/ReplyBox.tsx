import { useState } from 'react'
import { Send, Wand2 } from 'lucide-react'

type ReplyBoxProps = {
  onSend: (text: string) => Promise<void>
  onSuggest?: () => Promise<string>
}

export function ReplyBox({ onSend, onSuggest }: ReplyBoxProps) {
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
          <button
            className="inline-flex items-center justify-center size-8 rounded-md border border-transparent text-neutral-300 hover:bg-neutral-900"
            title="Suggest with AI"
            aria-label="Suggest with AI"
            onClick={async () => {
              const suggestion = (await onSuggest()) || ''
              if (suggestion) setValue(suggestion)
            }}
          >
            <Wand2 className="size-4" />
          </button>
        ) : null}
        <button
          className="inline-flex items-center justify-center size-8 rounded-md border border-transparent text-neutral-300 hover:bg-neutral-900"
          title={sending ? 'Sending…' : 'Send reply'}
          aria-label={sending ? 'Sending…' : 'Send reply'}
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
        </button>
      </div>
    </div>
  )
}


import { useState } from 'react'
import { Plus, X, Check } from 'lucide-react'

type CategoryManagerProps = {
  categories: string[]
  onAdd: (name: string) => void
  onRemove: (name: string) => void
}

export function CategoryManager({ categories, onAdd, onRemove }: CategoryManagerProps) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  
  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-medium text-neutral-400">Categories</div>
        <button
          className="size-5 grid place-items-center rounded hover:bg-neutral-800"
          onClick={() => setAdding((v) => !v)}
          title="Add category"
        >
          <Plus className="size-3" />
        </button>
      </div>
      {adding ? (
        <div className="flex items-center gap-1 mb-1">
          <input
            autoFocus
            className="flex-1 h-7 rounded bg-neutral-900 border border-neutral-800 px-2 text-xs outline-none focus:ring-1 focus:ring-neutral-700"
            placeholder="New category"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const n = newName.trim()
                if (n && !categories.includes(n)) {
                  onAdd(n)
                  setNewName('')
                  setAdding(false)
                }
              }
              if (e.key === 'Escape') {
                setAdding(false)
                setNewName('')
              }
            }}
          />
          <button
            className="size-7 grid place-items-center rounded hover:bg-neutral-800"
            onClick={() => {
              const n = newName.trim()
              if (n && !categories.includes(n)) {
                onAdd(n)
                setNewName('')
                setAdding(false)
              }
            }}
          >
            <Check className="size-3" />
          </button>
          <button
            className="size-7 grid place-items-center rounded hover:bg-neutral-800"
            onClick={() => {
              setAdding(false)
              setNewName('')
            }}
          >
            <X className="size-3" />
          </button>
        </div>
      ) : null}
      <div className="space-y-0.5">
        {categories.map((c) => (
          <div key={c} className="flex items-center justify-between group rounded px-2 py-1 hover:bg-neutral-900">
            <span className="text-xs text-neutral-300">{c}</span>
            <button
              className="size-4 grid place-items-center rounded opacity-0 group-hover:opacity-100 hover:bg-neutral-800"
              onClick={() => onRemove(c)}
              title="Remove category"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}


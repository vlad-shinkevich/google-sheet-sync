import * as React from 'react'
import { Pencil } from 'lucide-react'

type Props = {
  pressed: boolean
  onPressedChange: (v: boolean) => void
}

export function AnalyzeToggle({ pressed, onPressedChange }: Props) {
  return (
    <button
      className={
        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ' +
        (pressed ? 'bg-orange-50 border-orange-400 text-orange-600' : 'border-input text-foreground')
      }
      onClick={() => onPressedChange(!pressed)}
      aria-pressed={pressed}
      title="Mark for analyze"
    >
      <Pencil className="h-3.5 w-3.5" />
      <span>{pressed ? 'Analyze mode' : 'Mark for analyze'}</span>
    </button>
  )
}



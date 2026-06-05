'use client'

import { useRef, useEffect, type TextareaHTMLAttributes } from 'react'

// Textarea, die mit dem Inhalt mitwächst, statt Text abzuschneiden.
// Höhe wird bei jeder Wert-Änderung an scrollHeight angepasst.
export function AutoGrowTextarea({ value, style, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const resize = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  // Nach jedem Render mit neuem Wert neu messen (auch initial)
  useEffect(resize, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onInput={resize}
      style={{ overflow: 'hidden', ...style }}
      {...props}
    />
  )
}

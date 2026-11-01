'use client'

import { useState, type ReactNode } from 'react'

// Geteilter Sortier-Baustein für die GESAMTE App: ganze Zeile per Drag & Drop ziehbar
// (kein Handle). Einheitliche Optik: gezogene Zeile halbtransparent, Drop-Ziel mit
// Linie markiert. onReorder(from, to) liefert alte/neue Position.
export function SortableList<T>({
  items,
  onReorder,
  renderItem,
  getKey,
  disabled = false,
  className = 'space-y-1.5',
}: {
  items: T[]
  onReorder: (from: number, to: number) => void
  renderItem: (item: T, index: number) => ReactNode
  getKey: (item: T, index: number) => string | number
  disabled?: boolean
  className?: string
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  return (
    <div className={className}>
      {items.map((item, i) => {
        const isDragging = dragIndex === i
        const isDropTarget = overIndex === i && dragIndex !== null && dragIndex !== i
        return (
          <div
            key={getKey(item, i)}
            draggable={!disabled}
            onDragStart={e => { setDragIndex(i); e.dataTransfer.effectAllowed = 'move' }}
            onDragOver={e => { if (dragIndex === null) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (overIndex !== i) setOverIndex(i) }}
            onDrop={e => { e.preventDefault(); if (dragIndex !== null && dragIndex !== i) onReorder(dragIndex, i); setDragIndex(null); setOverIndex(null) }}
            onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
            style={{
              opacity: isDragging ? 0.5 : 1,
              cursor: disabled ? undefined : 'grab',
              borderTop: isDropTarget ? '2px solid var(--primary)' : '2px solid transparent',
              transition: 'opacity 0.12s',
            }}
          >
            {renderItem(item, i)}
          </div>
        )
      })}
    </div>
  )
}

export default SortableList

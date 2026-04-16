'use client'

import { useState, useEffect, useMemo } from 'react'
import { Loader2, Check, Clock, Circle, AlertCircle } from 'lucide-react'
import { getAllTodos, updateTodo, getMyContact, getEffectiveRole, isEditorRole, type Todo, type TodoStatus } from '@/lib/api-client'

const STATUS_NEXT: Record<TodoStatus, TodoStatus> = {
  open:        'in_progress',
  in_progress: 'done',
  done:        'open',
}

const PRIORITY_COLOR: Record<string, string> = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#6b7280',
}

function StatusIcon({ status }: { status: TodoStatus }) {
  if (status === 'done')        return <Check size={13} className="text-green-500 flex-shrink-0" />
  if (status === 'in_progress') return <Clock size={13} className="text-amber-500 flex-shrink-0" />
  return <Circle size={13} className="text-gray-300 flex-shrink-0" />
}

function isOverdue(deadline: string | null) {
  if (!deadline) return false
  const today = new Date(); today.setHours(0,0,0,0)
  return new Date(deadline) < today
}

type Filter = 'all' | 'open' | 'overdue'

export default function GlobalTodoOverview() {
  const [todos, setTodos]           = useState<Todo[]>([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState<Filter>('open')
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [myContactId, setMyContactId] = useState<number | null>(null)

  const effectiveRole = getEffectiveRole()
  const isAdmin  = isEditorRole(effectiveRole)      // 1-3: sieht alle Todos
  const isGuest  = effectiveRole === 'guest'        // 7: sieht gar nichts

  useEffect(() => {
    if (isGuest) { setLoading(false); return }
    const fetches: Promise<void>[] = [
      getAllTodos().catch(() => []).then(setTodos),
    ]
    if (!isAdmin) {
      fetches.push(
        getMyContact().then(c => setMyContactId(Number(c.id))).catch(() => {})
      )
    }
    Promise.all(fetches).finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Nicht-Admins sehen nur ihre eigenen zugewiesenen Aufgaben
  const visibleTodos = isAdmin
    ? todos
    : todos.filter(t => t.assignedContactId === myContactId)

  const filtered = useMemo(() => {
    switch (filter) {
      case 'open':    return visibleTodos.filter(t => t.status !== 'done')
      case 'overdue': return visibleTodos.filter(t => t.status !== 'done' && isOverdue(t.deadline))
      default:        return visibleTodos
    }
  }, [visibleTodos, filter])

  const overdueCount = visibleTodos.filter(t => t.status !== 'done' && isOverdue(t.deadline)).length
  const openCount    = visibleTodos.filter(t => t.status !== 'done').length

  const handleToggle = async (todo: Todo) => {
    setTogglingId(todo.id)
    try {
      const updated = await updateTodo(todo.terminId, todo.id, { status: STATUS_NEXT[todo.status] })
      setTodos(prev => prev.map(t => t.id === updated.id ? updated : t))
    } finally { setTogglingId(null) }
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })

  if (isGuest) return (
    <div className="flex flex-col h-full">
      <div className="pt-card-header">
        <span className="pt-card-title">Aufgaben</span>
      </div>
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
        Kein Zugriff
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <div className="pt-card-header">
        <span className="pt-card-title">{isAdmin ? 'Offene Aufgaben' : 'Meine Aufgaben'}</span>
        {overdueCount > 0 && (
          <span className="flex items-center gap-1 text-xs font-medium text-red-500">
            <AlertCircle size={12} /> {overdueCount} überfällig
          </span>
        )}
      </div>

      {/* Filter-Tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-gray-100">
        {([
          ['open',    `Offen (${openCount})`],
          ['overdue', `Überfällig (${overdueCount})`],
          ['all',     'Alle'],
        ] as [Filter, string][]).map(([f, label]) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-2 py-0.5 rounded text-xs transition-colors"
            style={{
              background: filter === f ? '#6366f1' : 'transparent',
              color:      filter === f ? '#fff' : '#6b7280',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            {filter === 'overdue' ? 'Keine überfälligen Aufgaben ✓' : 'Keine offenen Aufgaben ✓'}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(todo => (
              <div key={todo.id} className={`flex items-start gap-2 px-4 py-2 ${todo.status === 'done' ? 'opacity-40' : ''}`}>
                {/* Toggle */}
                <button
                  onClick={() => handleToggle(todo)}
                  disabled={togglingId === todo.id}
                  className="mt-0.5 flex-shrink-0 hover:opacity-70 transition-opacity"
                >
                  {togglingId === todo.id
                    ? <Loader2 size={13} className="animate-spin text-gray-300" />
                    : <StatusIcon status={todo.status} />
                  }
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      style={{ width: 5, height: 5, borderRadius: '50%', background: PRIORITY_COLOR[todo.priority] ?? '#6b7280', flexShrink: 0 }}
                    />
                    <span className={`text-xs text-gray-800 truncate ${todo.status === 'done' ? 'line-through' : ''}`}>
                      {todo.title}
                    </span>
                  </div>

                  {/* Kontext: Termin + Assignee + Deadline */}
                  <div className="flex flex-wrap gap-x-2 mt-0.5">
                    {todo.terminTitle && (
                      <button
                        onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-termin', { detail: { terminId: todo.terminId } }))}
                        className="text-xs text-indigo-400 truncate hover:text-indigo-600 hover:underline transition-colors text-left"
                        title="Zum Termin"
                      >
                        {todo.terminDate ? `${formatDate(todo.terminDate)} · ` : ''}{todo.terminTitle}
                        {todo.terminCity ? ` · ${todo.terminCity}` : ''}
                      </button>
                    )}
                    {(todo.assignedFirstName || todo.assignedLastName) && (
                      <span className="text-xs text-gray-400">
                        → {todo.assignedFirstName} {todo.assignedLastName}
                      </span>
                    )}
                    {todo.deadline && (
                      <span className="text-xs" style={{ color: isOverdue(todo.deadline) ? '#ef4444' : '#6b7280' }}>
                        {new Date(todo.deadline).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        {isOverdue(todo.deadline) ? ' ⚠' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

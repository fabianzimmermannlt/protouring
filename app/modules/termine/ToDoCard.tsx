'use client'

import { useState, useEffect } from 'react'
import { Plus, Loader2, Check, Clock, Circle, ChevronDown, ChevronUp, Pencil, Trash2, X } from 'lucide-react'
import {
  getTodos, createTodo, updateTodo, deleteTodo,
  getContacts, getMyContact, getEffectiveRole, isEditorRole,
  type Todo, type TodoStatus, type TodoPriority, type TodoFormData,
  type Contact,
} from '@/lib/api-client'

// ── helpers ────────────────────────────────────────────────────────────────

const STATUS_NEXT: Record<TodoStatus, TodoStatus> = {
  open:        'in_progress',
  in_progress: 'done',
  done:        'open',
}

const STATUS_LABEL: Record<TodoStatus, string> = {
  open:        'Offen',
  in_progress: 'In Bearbeitung',
  done:        'Erledigt',
}

const PRIORITY_LABEL: Record<TodoPriority, string> = {
  high:   'Hoch',
  medium: 'Mittel',
  low:    'Niedrig',
}

const PRIORITY_COLOR: Record<TodoPriority, string> = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#6b7280',
}

function StatusIcon({ status }: { status: TodoStatus }) {
  if (status === 'done')        return <Check size={14} className="text-green-500 flex-shrink-0" />
  if (status === 'in_progress') return <Clock size={14} className="text-amber-500 flex-shrink-0" />
  return <Circle size={14} className="text-gray-300 flex-shrink-0" />
}

function formatDeadline(d: string | null) {
  if (!d) return null
  const date = new Date(d)
  const today = new Date(); today.setHours(0,0,0,0)
  const diff = Math.ceil((date.getTime() - today.getTime()) / 86400000)
  const label = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  if (diff < 0)  return { label, color: '#ef4444', suffix: ` (${Math.abs(diff)}d überfällig)` }
  if (diff === 0) return { label, color: '#f59e0b', suffix: ' (heute)' }
  if (diff <= 3) return { label, color: '#f59e0b', suffix: ` (in ${diff}d)` }
  return { label, color: '#6b7280', suffix: '' }
}

// ── TodoForm (inline modal) ─────────────────────────────────────────────────

function TodoForm({
  initial, contacts, showAssign = true, onSave, onCancel, onDelete,
}: {
  initial?: Todo | null
  contacts: Contact[]
  showAssign?: boolean
  onSave: (data: TodoFormData) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
}) {
  const [title, setTitle]       = useState(initial?.title ?? '')
  const [description, setDesc]  = useState(initial?.description ?? '')
  const [priority, setPriority] = useState<TodoPriority>(initial?.priority ?? 'medium')
  const [assignedId, setAssigned] = useState<string>(initial?.assignedContactId ? String(initial.assignedContactId) : '')
  const [deadline, setDeadline] = useState(initial?.deadline?.slice(0, 10) ?? '')
  const [saving, setSaving]     = useState(false)

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        description: description || undefined,
        priority,
        assignedContactId: assignedId ? Number(assignedId) : null,
        deadline: deadline || null,
      })
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 100 }}>
      <div className="modal-container max-w-md">
        <div className="modal-header">
          <h2 className="modal-title">{initial ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="modal-body space-y-4">
          {/* Titel */}
          <div>
            <label className="form-label">Titel *</label>
            <input
              className="form-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
              placeholder="Was ist zu tun?"
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
          </div>

          {/* Beschreibung */}
          <div>
            <label className="form-label">Beschreibung</label>
            <textarea
              className="form-input"
              rows={3}
              value={description}
              onChange={e => setDesc(e.target.value)}
              placeholder="Optionale Details…"
            />
          </div>

          {/* Priorität + Deadline nebeneinander */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Priorität</label>
              <select className="form-select" value={priority} onChange={e => setPriority(e.target.value as TodoPriority)}>
                <option value="high">🔴 Hoch</option>
                <option value="medium">🟡 Mittel</option>
                <option value="low">⚪ Niedrig</option>
              </select>
            </div>
            <div>
              <label className="form-label">Deadline</label>
              <input
                type="date"
                className="form-input"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
              />
            </div>
          </div>

          {/* Zuweisen — nur für Rollen 1-3 */}
          {showAssign && (
            <div>
              <label className="form-label">Zugewiesen an</label>
              <select className="form-select" value={assignedId} onChange={e => setAssigned(e.target.value)}>
                <option value="">– niemand –</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {onDelete && (
            <button
              onClick={onDelete}
              className="btn btn-danger mr-auto"
              disabled={saving}
            >
              <Trash2 size={14} /> Löschen
            </button>
          )}
          <button onClick={onCancel} className="btn btn-secondary" disabled={saving}>Abbrechen</button>
          <button onClick={handleSave} className="btn btn-primary" disabled={saving || !title.trim()}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Speichern
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

const CAN_CREATE_ROLES = ['admin', 'agency', 'tourmanagement', 'artist', 'crew_plus']

export default function ToDoCard({ terminId }: { terminId: number }) {
  const [todos, setTodos]           = useState<Todo[]>([])
  const [contacts, setContacts]     = useState<Contact[]>([])
  const [loading, setLoading]       = useState(true)
  const [formOpen, setFormOpen]     = useState(false)
  const [editing, setEditing]       = useState<Todo | null>(null)
  const [showDone, setShowDone]     = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [myContactId, setMyContactId] = useState<number | null>(null)

  const effectiveRole = getEffectiveRole()
  const canSeeAll  = isEditorRole(effectiveRole)                        // 1-3: alle Todos
  const canCreate  = CAN_CREATE_ROLES.includes(effectiveRole)           // 1-5: anlegen
  const canAssign  = isEditorRole(effectiveRole)                        // 1-3: zuweisen
  const canEdit    = isEditorRole(effectiveRole)                        // 1-3: bearbeiten/löschen
  const isGuest    = effectiveRole === 'guest'

  useEffect(() => {
    if (isGuest) { setLoading(false); return }
    const fetches: Promise<void>[] = [
      getTodos(terminId).catch(() => []).then(setTodos),
    ]
    if (canAssign) {
      fetches.push(getContacts().catch(() => []).then(setContacts))
    }
    if (!canSeeAll) {
      fetches.push(getMyContact().then(c => setMyContactId(Number(c.id))).catch(() => {}))
    }
    Promise.all(fetches).finally(() => setLoading(false))
  }, [terminId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Nicht-Editoren sehen nur ihre eigenen Todos
  const visibleTodos = canSeeAll
    ? todos
    : todos.filter(t => t.assignedContactId === myContactId)

  const handleSave = async (data: TodoFormData) => {
    if (editing) {
      const updated = await updateTodo(terminId, editing.id, data)
      setTodos(prev => prev.map(t => t.id === updated.id ? updated : t))
    } else {
      const created = await createTodo(terminId, data)
      setTodos(prev => [...prev, created])
    }
    setFormOpen(false)
    setEditing(null)
  }

  const handleDelete = async () => {
    if (!editing) return
    await deleteTodo(terminId, editing.id)
    setTodos(prev => prev.filter(t => t.id !== editing.id))
    setFormOpen(false)
    setEditing(null)
  }

  const handleToggleStatus = async (todo: Todo) => {
    setTogglingId(todo.id)
    try {
      const updated = await updateTodo(terminId, todo.id, { status: STATUS_NEXT[todo.status] })
      setTodos(prev => prev.map(t => t.id === updated.id ? updated : t))
    } finally { setTogglingId(null) }
  }

  const openTodos = visibleTodos.filter(t => t.status !== 'done')
  const doneTodos = visibleTodos.filter(t => t.status === 'done')

  if (loading) return (
    <div className="pt-card flex items-center justify-center" style={{ minHeight: '120px' }}>
      <Loader2 size={16} className="animate-spin text-gray-400" />
    </div>
  )

  return (
    <>
      <div className="pt-card">
        <div className="pt-card-header">
          <span className="pt-card-title">TO DOs</span>
          <span className="text-xs text-gray-400 font-normal normal-case tracking-normal">
            {openTodos.length > 0 ? `${openTodos.length} offen` : 'alles erledigt ✓'}
          </span>
          {canCreate && (
            <button
              onClick={() => { setEditing(null); setFormOpen(true) }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Aufgabe hinzufügen"
            >
              <Plus size={14} />
            </button>
          )}
        </div>

        {isGuest ? (
          <div className="pt-card-body text-sm text-gray-400 text-center py-4">
            Kein Zugriff
          </div>
        ) : visibleTodos.length === 0 ? (
          <div className="pt-card-body text-sm text-gray-400 text-center py-4">
            Noch keine Aufgaben
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {/* offene + in Bearbeitung */}
            {openTodos.map(todo => (
              <TodoRow
                key={todo.id}
                todo={todo}
                canEdit={canEdit}
                toggling={togglingId === todo.id}
                onToggle={() => handleToggleStatus(todo)}
                onEdit={() => { setEditing(todo); setFormOpen(true) }}
              />
            ))}

            {/* Erledigte (collapsible) */}
            {doneTodos.length > 0 && (
              <>
                <button
                  className="w-full flex items-center gap-1 px-4 py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  onClick={() => setShowDone(v => !v)}
                >
                  {showDone ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {doneTodos.length} erledigt
                </button>
                {showDone && doneTodos.map(todo => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    canEdit={canEdit}
                    toggling={togglingId === todo.id}
                    onToggle={() => handleToggleStatus(todo)}
                    onEdit={() => { setEditing(todo); setFormOpen(true) }}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {formOpen && (
        <TodoForm
          initial={editing}
          contacts={canAssign ? contacts : []}
          showAssign={canAssign}
          onSave={handleSave}
          onCancel={() => { setFormOpen(false); setEditing(null) }}
          onDelete={editing && canEdit ? handleDelete : undefined}
        />
      )}
    </>
  )
}

// ── TodoRow ─────────────────────────────────────────────────────────────────

function TodoRow({ todo, canEdit, toggling, onToggle, onEdit }: {
  todo: Todo
  canEdit: boolean
  toggling: boolean
  onToggle: () => void
  onEdit: () => void
}) {
  const dl = formatDeadline(todo.deadline)
  const isDone = todo.status === 'done'

  return (
    <div className={`flex items-start gap-2 px-4 py-2.5 group ${isDone ? 'opacity-50' : ''}`}>
      {/* Status-Toggle */}
      <button
        onClick={onToggle}
        disabled={toggling}
        title={`Weiter zu: ${STATUS_LABEL[STATUS_NEXT[todo.status]]}`}
        className="mt-0.5 flex-shrink-0 hover:opacity-70 transition-opacity"
      >
        {toggling
          ? <Loader2 size={14} className="animate-spin text-gray-300" />
          : <StatusIcon status={todo.status} />
        }
      </button>

      {/* Inhalt */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {/* Prioritäts-Dot */}
          <span
            style={{ width: 6, height: 6, borderRadius: '50%', background: PRIORITY_COLOR[todo.priority], flexShrink: 0 }}
            title={PRIORITY_LABEL[todo.priority]}
          />
          <span className={`text-sm text-gray-800 truncate ${isDone ? 'line-through' : ''}`}>
            {todo.title}
          </span>
        </div>

        {/* Meta-Zeile */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
          {(todo.assignedFirstName || todo.assignedLastName) && (
            <span className="text-xs text-gray-400">
              → {todo.assignedFirstName} {todo.assignedLastName}
            </span>
          )}
          {dl && (
            <span className="text-xs" style={{ color: dl.color }}>
              {dl.label}{dl.suffix}
            </span>
          )}
        </div>
      </div>

      {/* Edit-Button (nur Rollen 1-3, nur on hover) */}
      {canEdit && (
        <button
          onClick={onEdit}
          title="Bearbeiten"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5"
        >
          <Pencil size={12} />
        </button>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Loader2 } from 'lucide-react'
import { getTerminSchedules, createTerminSchedule, updateTerminSchedule, deleteTerminSchedule, type TerminSchedule, API_BASE, getAuthToken, getCurrentTenant } from '@/lib/api-client'
import { renderBoardContent } from '@/app/components/shared/ContentBoard'
import ContentBoardModal, { type ContentBoardModalProps } from '@/app/components/shared/ContentBoardModal'
import type { BoardItem, BoardItemFormData } from '@/lib/api-client'

// Adapter: TerminSchedule → BoardItem (für ContentBoardModal)
function scheduleToBoardItem(s: TerminSchedule): BoardItem {
  return {
    id: s.id,
    tenantId: s.tenantId,
    entityType: 'termin',
    entityId: String(s.terminId),
    title: s.title,
    content: s.content,
    notFinal: s.notFinal,
    sortOrder: s.sortOrder,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }
}

function openSchedulePdf(terminId: number, scheduleId: number) {
  const token = getAuthToken()
  const tenant = getCurrentTenant()
  const params = new URLSearchParams()
  if (token) params.set('token', token)
  if (tenant?.slug) params.set('tenant', tenant.slug)
  const url = `${API_BASE}/api/termine/${terminId}/schedules/${scheduleId}/pdf?${params}`
  window.open(url, '_blank')
}

export default function ZeitplaeneCard({ terminId, isAdmin }: { terminId: number; isAdmin: boolean }) {
  const [schedules, setSchedules] = useState<TerminSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TerminSchedule | null>(null)

  useEffect(() => {
    getTerminSchedules(terminId)
      .then(setSchedules)
      .catch(() => setSchedules([]))
      .finally(() => setLoading(false))
  }, [terminId])

  const openNew = () => { setEditing(null); setModalOpen(true) }
  const openEdit = (s: TerminSchedule) => { setEditing(s); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditing(null) }

  const handleSave = async (data: BoardItemFormData) => {
    const saved = editing
      ? await updateTerminSchedule(terminId, editing.id, { ...data, sortOrder: editing.sortOrder })
      : await createTerminSchedule(terminId, { ...data, sortOrder: schedules.length })
    setSchedules(prev => {
      const exists = prev.find(s => s.id === saved.id)
      return exists ? prev.map(s => s.id === saved.id ? saved : s) : [...prev, saved]
    })
    closeModal()
  }

  const handleDelete = async () => {
    if (!editing) return
    await deleteTerminSchedule(terminId, editing.id)
    setSchedules(prev => prev.filter(s => s.id !== editing.id))
    closeModal()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 size={16} className="animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <>
      {schedules.map(s => (
        <div key={s.id} className="pt-card">
          <div className="pt-card-header">
            <span className="pt-card-title">
              {s.title || <span className="normal-case font-normal tracking-normal text-gray-400 italic">Ohne Titel</span>}
            </span>
            {s.notFinal && (
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-500 text-white uppercase tracking-wide flex-shrink-0">
                Noch nicht final
              </span>
            )}
            <button
              onClick={() => openSchedulePdf(s.terminId, s.id)}
              className="text-gray-400 hover:text-blue-600 transition-colors flex-shrink-0"
              title="Als PDF öffnen"
            >
              <svg width="13" height="16" viewBox="0 0 26 32" fill="none" xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
                <path d="M0 0H18L26 8V32H0V0Z" fill="none" stroke="currentColor" strokeWidth="2"/>
                <path d="M18 0V8H26" fill="none" stroke="currentColor" strokeWidth="2"/>
                <rect x="0" y="20" width="26" height="12" fill="currentColor"/>
                <text x="3" y="29" fontSize="9" fontWeight="800" fill="white" fontFamily="Helvetica,Arial,sans-serif" letterSpacing="0.5">PDF</text>
              </svg>
            </button>
            {isAdmin && (
              <button
                onClick={() => openEdit(s)}
                className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                title="Bearbeiten"
              >
                <Pencil size={12} />
              </button>
            )}
          </div>

          {s.content && (
            <div className="rich-content pt-card-body text-sm text-gray-700 space-y-0.5">
              {renderBoardContent(s.content)}
            </div>
          )}
        </div>
      ))}

      {isAdmin && (
        <button onClick={openNew} className="pt-card-new">
          <div className="flex items-center justify-center gap-2 px-4 py-4 text-gray-300">
            <Plus size={14} />
            <span className="text-xs font-medium">Neuer Zeitplan</span>
          </div>
        </button>
      )}

      {modalOpen && (
        <ContentBoardModal
          item={editing ? scheduleToBoardItem(editing) : null}
          sortOrder={schedules.length}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={editing ? handleDelete : undefined}
          showLRSeparator
          showNotFinal
          modalTitle={{ new: 'Neuer Zeitplan', edit: 'Zeitplan bearbeiten' }}
          titlePlaceholder="z.B. Daysheet, Festival Lineup, Folgetag"
        />
      )}
    </>
  )
}

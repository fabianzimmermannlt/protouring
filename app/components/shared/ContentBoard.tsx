'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Loader2 } from 'lucide-react'
import {
  getBoardItems,
  createBoardItem,
  updateBoardItem,
  deleteBoardItem,
  type BoardItem,
  type BoardItemFormData,
} from '@/lib/api-client'
import ContentBoardModal from './ContentBoardModal'

// ============================================================
// renderContent — gemeinsame Render-Logik für Board-Inhalte.
// Identisch zu ZeitplaeneCard.renderContent, damit Darstellung
// überall gleich ist.
// ============================================================

export function renderBoardContent(html: string) {
  if (!html) return null

  const normalized = html
    .replace(/<div><br\s*\/?><\/div>/gi, '\n')
    .replace(/<p><br\s*\/?><\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<div>/gi, '')
    .replace(/<p>/gi, '')
    .replace(/\n{3,}/g, '\n\n')

  const lines = normalized.split('\n')
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()

  return lines.map((lineHtml, i) => {
    const plain = lineHtml.replace(/<[^>]+>/g, '').trim()

    if (plain === '---' || /^<hr\s*\/?>$/i.test(lineHtml.trim())) {
      return <hr key={i} />
    }

    const sepIdx = lineHtml.indexOf('-//-')
    if (sepIdx !== -1) {
      const leftHtml = lineHtml.substring(0, sepIdx)
      const rightHtml = lineHtml.substring(sepIdx + 4)
      return (
        <div key={i} className="flex justify-between gap-4">
          <span dangerouslySetInnerHTML={{ __html: leftHtml || '' }} />
          <span className="text-right flex-shrink-0" dangerouslySetInnerHTML={{ __html: rightHtml || '' }} />
        </div>
      )
    }

    if (!plain) return <div key={i} className="h-3" />
    return <div key={i} dangerouslySetInnerHTML={{ __html: lineHtml }} />
  })
}

// ============================================================
// ContentBoard
// Generische Board-Kachel: lädt Einträge aus /api/boards/:entityType/:entityId.
// Verwendung: Schreibtisch Pinnwand, Notizen, etc.
// ============================================================

interface ContentBoardProps {
  entityType: string
  entityId: string
  title: string
  isAdmin: boolean
  /** L-//-R Button im Editor (Zeitplan-spezifisch) */
  showLRSeparator?: boolean
  /** "noch nicht final" Checkbox (Zeitplan-spezifisch) */
  showNotFinal?: boolean
  modalTitle?: { new: string; edit: string }
  titlePlaceholder?: string
  /** Label für den "Neu"-Button */
  newItemLabel?: string
  /**
   * Einzelner Eintrag: kein Neu-Button wenn Item vorhanden,
   * Item-Titel wird als Kachel-Header angezeigt.
   */
  singleItem?: boolean
  /**
   * Fester Kachel-Titel im singleItem-Modus (überschreibt item.title).
   * Nützlich z.B. für persönliche Notizen wo der Header immer gleich lautet.
   */
  fixedTitle?: string
  /** Titelfeld im Modal ausblenden */
  showTitleField?: boolean
  /**
   * singleItem-Modus: "Neu"-Button im Leer-Zustand ausblenden.
   * Stattdessen ist das Stift-Icon im Header immer sichtbar (öffnet neuen oder bestehenden Eintrag).
   */
  hideEmptyButton?: boolean
  /** Löschen-Button im Modal ausblenden */
  allowDelete?: boolean
  /**
   * Standardinhalt: wenn kein Eintrag existiert, wird automatisch einer
   * mit diesem Titel + Inhalt angelegt (nur wenn isAdmin=true).
   */
  defaultContent?: { title: string; content: string }
  className?: string
  /** singleItem-Modus: internen Header ausblenden (z.B. wenn AccordionSection den Titel bereits zeigt) */
  hideHeader?: boolean
  /** Callback wenn Item geladen wurde – liefert Titel oder null (für dynamische AccordionSection-Titel) */
  onItemLoaded?: (title: string | null) => void
}

export default function ContentBoard({
  entityType,
  entityId,
  title,
  isAdmin,
  showLRSeparator = false,
  showNotFinal = false,
  modalTitle,
  titlePlaceholder,
  newItemLabel = 'Neuer Eintrag',
  singleItem = false,
  fixedTitle,
  showTitleField = true,
  hideEmptyButton = false,
  allowDelete = true,
  defaultContent,
  className = '',
  hideHeader = false,
  onItemLoaded,
}: ContentBoardProps) {
  const [items, setItems] = useState<BoardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<BoardItem | null>(null)

  useEffect(() => {
    getBoardItems(entityType, entityId)
      .then(async (loaded) => {
        // Wenn kein Eintrag vorhanden und defaultContent definiert → automatisch anlegen
        if (loaded.length === 0 && defaultContent && isAdmin) {
          try {
            const created = await createBoardItem(entityType, entityId, { title: defaultContent.title, content: defaultContent.content, notFinal: false, sortOrder: 0 })
            setItems([created])
            onItemLoaded?.(created.title ?? null)
          } catch {
            setItems([])
            onItemLoaded?.(null)
          }
        } else {
          setItems(loaded)
          onItemLoaded?.(loaded[0]?.title ?? null)
        }
      })
      .catch(e => {
        console.error('[ContentBoard] load error:', e)
        setLoadError(e?.message ?? 'Ladefehler')
        setItems([])
      })
      .finally(() => setLoading(false))
  }, [entityType, entityId])

  const openNew = () => { setEditing(null); setModalOpen(true) }
  const openEdit = (item: BoardItem) => { setEditing(item); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditing(null) }

  const handleSave = async (data: BoardItemFormData) => {
    console.log('[ContentBoard] saving:', { entityType, entityId, data })
    const saved = editing
      ? await updateBoardItem(entityType, entityId, editing.id, { ...data, sortOrder: editing.sortOrder })
      : await createBoardItem(entityType, entityId, { ...data, sortOrder: items.length })
    console.log('[ContentBoard] saved:', saved)
    setItems(prev => {
      const exists = prev.find(i => i.id === saved.id)
      return exists ? prev.map(i => i.id === saved.id ? saved : i) : [...prev, saved]
    })
    closeModal()
  }

  const handleDelete = async () => {
    if (!editing) return
    await deleteBoardItem(entityType, entityId, editing.id)
    setItems(prev => prev.filter(i => i.id !== editing.id))
    closeModal()
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-6 ${className}`}>
        <Loader2 size={16} className="animate-spin text-gray-400" />
      </div>
    )
  }

  // Bei singleItem: nur den ersten Eintrag anzeigen
  const displayItems = singleItem ? items.slice(0, 1) : items
  const singleItemExists = singleItem && items.length > 0
  const singleItemValue = singleItemExists ? items[0] : null

  // singleItem-Modus: füllt die äußere pt-card komplett aus (kein eigenes Padding)
  if (singleItem) {
    return (
      <>
        <div className={`flex flex-col h-full ${className}`}>
          {/* Header — identisch zu pt-card-header; ausblendbar wenn AccordionSection den Titel zeigt */}
          {!hideHeader ? (
            <div className="pt-card-header">
              <span className="pt-card-title">
                {fixedTitle ?? singleItemValue?.title ?? (
                  <span className="normal-case font-normal tracking-normal text-gray-400 italic">Kein Eintrag</span>
                )}
              </span>
              {isAdmin && (singleItemValue || hideEmptyButton) && (
                <button
                  onClick={() => singleItemValue ? openEdit(singleItemValue) : openNew()}
                  className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                  title="Bearbeiten"
                >
                  <Pencil size={13} />
                </button>
              )}
            </div>
          ) : (
            isAdmin && (singleItemValue || hideEmptyButton) && (
              <div className="flex justify-end px-3 pt-2">
                <button
                  onClick={() => singleItemValue ? openEdit(singleItemValue) : openNew()}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Bearbeiten"
                >
                  <Pencil size={13} />
                </button>
              </div>
            )
          )}

          {/* Inhalt */}
          {singleItemValue?.content ? (
            <div className="rich-content flex-1 overflow-y-auto text-sm text-gray-700 space-y-0.5 pt-card-body">
              {renderBoardContent(singleItemValue.content)}
            </div>
          ) : (
            <div className="flex-1" />
          )}

          {/* Admin: Neu-Button nur wenn noch kein Eintrag und nicht ausgeblendet */}
          {isAdmin && !singleItemValue && !hideEmptyButton && (
            <button onClick={openNew} className="pt-card-new mx-4 my-4">
              <div className="flex items-center justify-center gap-2 px-4 py-4 text-gray-300">
                <Plus size={14} />
                <span className="text-xs font-medium">{newItemLabel}</span>
              </div>
            </button>
          )}

          {/* Ladefehler */}
          {loadError && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs mx-4 mb-2">{loadError}</div>
          )}
        </div>

        {modalOpen && (
          <ContentBoardModal
            item={editing}
            sortOrder={0}
            onClose={closeModal}
            onSave={handleSave}
            onDelete={allowDelete && editing ? handleDelete : undefined}
            showLRSeparator={showLRSeparator}
            showNotFinal={showNotFinal}
            modalTitle={modalTitle}
            titlePlaceholder={titlePlaceholder}
            showTitleField={showTitleField}
          />
        )}
      </>
    )
  }

  return (
    <>
      <div className={className}>
        {/* Kachel-Titel */}
        {title && (
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          </div>
        )}

        <div className="space-y-3">
          {/* Einzelne Einträge */}
          {displayItems.map(item => (
            <div key={item.id} className="pt-card">
              {/* Header */}
              <div className="pt-card-header">
                <span className="pt-card-title">
                  {item.title || <span className="normal-case font-normal tracking-normal text-gray-400 italic">Ohne Titel</span>}
                </span>
                {showNotFinal && item.notFinal && (
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-500 text-white uppercase tracking-wide flex-shrink-0">
                    Noch nicht final
                  </span>
                )}
                {isAdmin && (
                  <button
                    onClick={() => openEdit(item)}
                    className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                    title="Bearbeiten"
                  >
                    <Pencil size={12} />
                  </button>
                )}
              </div>

              {/* Inhalt */}
              {item.content && (
                <div className="rich-content pt-card-body text-sm text-gray-700 space-y-0.5">
                  {renderBoardContent(item.content)}
                </div>
              )}
            </div>
          ))}

          {/* "Neu"-Button für Admins */}
          {isAdmin && (
            <button onClick={openNew} className="pt-card-new">
              <div className="flex items-center justify-center gap-2 px-4 py-4 text-gray-300">
                <Plus size={14} />
                <span className="text-xs font-medium">{newItemLabel}</span>
              </div>
            </button>
          )}

          {/* Ladefehler */}
          {loadError && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{loadError}</div>
          )}

          {/* Leer-Zustand für Nicht-Admins */}
          {!isAdmin && items.length === 0 && !loadError && (
            <div className="text-center py-6 text-gray-400 text-sm">Keine Einträge</div>
          )}
        </div>
      </div>

      {modalOpen && (
        <ContentBoardModal
          item={editing}
          sortOrder={items.length}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={editing ? handleDelete : undefined}
          showLRSeparator={showLRSeparator}
          showNotFinal={showNotFinal}
          modalTitle={modalTitle}
          titlePlaceholder={titlePlaceholder}
        />
      )}
    </>
  )
}

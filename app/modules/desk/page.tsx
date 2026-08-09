'use client'

import { useState, useEffect, useCallback } from 'react'
import { Pencil } from 'lucide-react'
import { Communication } from '@/app/components/shared/Communication'
import { FileCard } from '@/app/components/shared/FileCard'
import ContentBoard from '@/app/components/shared/ContentBoard'
import GlobalTodoOverview from '@/app/components/shared/GlobalTodoOverview'
import { getCurrentUser, getCurrentTenant, getMyRole, updateCurrentTenantRole, isEditorRole, getEffectiveRole, can } from '@/lib/api-client'
import { CollapsibleCard } from '@/app/components/shared/CollapsibleCard'
import RecentChatMessages from '@/app/components/shared/RecentChatMessages'

type Zone = 'team' | 'personal'
const ZONE_KEY = 'desk_zone'

export default function SchreibtischModule() {
  const effectiveRole = getEffectiveRole()
  const isEditor = isEditorRole(effectiveRole)
  const isGuest  = effectiveRole === 'guest'
  const currentUser = getCurrentUser()
  const currentUserId = currentUser ? String(currentUser.id) : 'unknown'
  const [announcementTitle, setAnnouncementTitle] = useState('Herzlich willkommen')
  const [zone, setZone] = useState<Zone>('team')
  const [editAnnouncement, setEditAnnouncement] = useState<(() => void) | null>(null)
  const [editNotes, setEditNotes] = useState<(() => void) | null>(null)
  const provideAnnouncementEdit = useCallback((fn: (() => void) | null) => setEditAnnouncement(() => fn), [])
  const provideNotesEdit = useCallback((fn: (() => void) | null) => setEditNotes(() => fn), [])

  const editPencil = (onClick: () => void) => (
    <button onClick={onClick} className="text-gray-400 hover:text-gray-600 transition-colors" title="Bearbeiten">
      <Pencil size={13} />
    </button>
  )

  useEffect(() => {
    getMyRole().then(freshRole => {
      if (freshRole && freshRole !== getCurrentTenant()?.role) updateCurrentTenantRole(freshRole)
    }).catch(() => {})
    try { const z = localStorage.getItem(ZONE_KEY); if (z === 'team' || z === 'personal') setZone(z) } catch {}
  }, [])

  const pickZone = (z: Zone) => { setZone(z); try { localStorage.setItem(ZONE_KEY, z) } catch {} }

  return (
    <div className="pb-10">
      {/* Datum */}
      <div className="mb-3 text-sm" style={{ color: 'var(--text-muted)' }}>
        {new Date().toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </div>

      {/* Reiter: Team / Persönlich (gleicher Stil wie Event-Tabs) */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', overflowX: 'auto', marginBottom: '1rem' }}>
        <button onClick={() => pickZone('team')} className={`pt-detail-tab${zone === 'team' ? ' active' : ''}`}>Team</button>
        <button onClick={() => pickZone('personal')} className={`pt-detail-tab${zone === 'personal' ? ' active' : ''}`}>Persönlich</button>
      </div>

      {/* ── Team ── */}
      {zone === 'team' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          <CollapsibleCard title={announcementTitle} defaultOpen actions={editAnnouncement ? editPencil(editAnnouncement) : undefined}>
            <ContentBoard
              entityType="desk" entityId="announcement" title=""
              isAdmin={can('CAN_EDIT_ANKUENDIGUNG', effectiveRole)}
              singleItem hideHeader hideEmptyButton allowDelete={false}
              modalTitle={{ new: 'Ankündigung erstellen', edit: 'Ankündigung bearbeiten' }}
              titlePlaceholder="Titel der Ankündigung" newItemLabel="Ankündigung erstellen"
              defaultContent={{ title: 'Herzlich willkommen 👋', content: 'Hier kannst du aktuelle Infos, Ankündigungen oder Hinweise für dein Team hinterlegen.' }}
              onItemLoaded={t => setAnnouncementTitle(t ?? 'Herzlich willkommen')}
              provideEditAction={provideAnnouncementEdit}
            />
          </CollapsibleCard>

          <CollapsibleCard title="Offene Aufgaben" defaultOpen>
            <GlobalTodoOverview hideHeader />
          </CollapsibleCard>

          <CollapsibleCard title="Letzte Nachrichten" defaultOpen>
            <RecentChatMessages currentUserId={currentUser?.id} hideHeader />
          </CollapsibleCard>

          <CollapsibleCard title="Allgemeiner Chat" defaultOpen>
            <Communication entityType="desk" entityId="general" showHeader={false} className="h-80" />
          </CollapsibleCard>

          {!isGuest && (
            <FileCard title="Allgemeine Dateien" entityType="desk" entityId="shared" category="general" maxFiles={10} maxFileSizeMB={50} canManage={isEditor} />
          )}
        </div>
      )}

      {/* ── Persönlich ── */}
      {zone === 'personal' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          <CollapsibleCard title="Persönliche Notizen" defaultOpen actions={editNotes ? editPencil(editNotes) : undefined}>
            <ContentBoard entityType="desk_personal" entityId={currentUserId} title="" isAdmin={true}
              singleItem hideHeader hideEmptyButton allowDelete={false}
              fixedTitle="Persönliche Notizen" showTitleField={false}
              modalTitle={{ new: 'Notiz bearbeiten', edit: 'Notiz bearbeiten' }}
              newItemLabel="Notiz erstellen" defaultContent={{ title: 'Persönliche Notizen', content: '' }}
              provideEditAction={provideNotesEdit} />
          </CollapsibleCard>

          {!isGuest && (
            <FileCard title="Persönliche Dateien" entityType="desk" entityId={currentUserId} category="personal" maxFiles={10} maxFileSizeMB={20} canManage={true} />
          )}

          <CollapsibleCard title="Pinnwand" defaultOpen>
            <ContentBoard entityType="desk_personal" entityId={`${currentUserId}_board`} title="" isAdmin={true}
              modalTitle={{ new: 'Neue Notiz', edit: 'Notiz bearbeiten' }}
              titlePlaceholder="Titel" newItemLabel="Neue Notiz" />
          </CollapsibleCard>
        </div>
      )}
    </div>
  )
}

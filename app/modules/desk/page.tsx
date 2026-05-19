'use client'

import { useState, useEffect } from 'react'
import { Communication } from '@/app/components/shared/Communication'
import { FileCard } from '@/app/components/shared/FileCard'
import ContentBoard from '@/app/components/shared/ContentBoard'
import GlobalTodoOverview from '@/app/components/shared/GlobalTodoOverview'
import { getCurrentUser, getCurrentTenant, getMyRole, updateCurrentTenantRole, isAdminRole, isEditorRole, getEffectiveRole, canDo, CAN_EDIT_ANKUENDIGUNG } from '@/lib/api-client'
import { AccordionSection } from '@/app/components/shared/AccordionSection'
import RecentChatMessages from '@/app/components/shared/RecentChatMessages'

export default function SchreibtischModule() {
  const effectiveRole = getEffectiveRole()
  const isAdmin  = isAdminRole(effectiveRole)
  const isEditor = isEditorRole(effectiveRole)
  const currentUser = getCurrentUser()
  const currentUserId = currentUser ? String(currentUser.id) : 'unknown'
  const [announcementTitle, setAnnouncementTitle] = useState('Herzlich willkommen')

  // Rolle im Hintergrund aktualisieren
  useEffect(() => {
    getMyRole().then(freshRole => {
      if (freshRole && freshRole !== getCurrentTenant()?.role) {
        updateCurrentTenantRole(freshRole)
      }
    }).catch(() => {})
  }, [])

  const cardStyle: React.CSSProperties = {
    background: '#2d2d2d',
    borderRadius: '0.625rem',
    border: '1px solid #3a3a3a',
    display: 'flex',
    flexDirection: 'column',
    height: '400px',
    overflow: 'hidden',
  }

  return (
    <>
      {/* Datum */}
      <div className="mb-4 text-center">
        <div className="text-lg font-medium" style={{ color: '#9ca3af' }}>
          {new Date().toLocaleDateString('de-DE', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          })}
        </div>
      </div>

      {/* ── MOBILE: Accordion ── */}
      <div className="md:hidden flex flex-col gap-2">
        <AccordionSection title={announcementTitle} defaultOpen stateKey="desk_ankuendigung">
          <ContentBoard
            entityType="desk" entityId="announcement" title=""
            isAdmin={canDo(effectiveRole, CAN_EDIT_ANKUENDIGUNG)}
            singleItem hideHeader hideEmptyButton allowDelete={false}
            modalTitle={{ new: 'Ankündigung erstellen', edit: 'Ankündigung bearbeiten' }}
            titlePlaceholder="Titel der Ankündigung" newItemLabel="Ankündigung erstellen"
            defaultContent={{ title: 'Herzlich willkommen 👋', content: 'Hier kannst du aktuelle Infos, Ankündigungen oder Hinweise für dein Team hinterlegen.' }}
            onItemLoaded={t => setAnnouncementTitle(t ?? 'Herzlich willkommen')}
          />
        </AccordionSection>

        <AccordionSection title="Offene Aufgaben" defaultOpen stateKey="desk_aufgaben">
          <div className="p-1"><GlobalTodoOverview hideHeader /></div>
        </AccordionSection>

        <AccordionSection title="Letzte Nachrichten" defaultOpen stateKey="desk_recent_chat">
          <div className="p-1"><RecentChatMessages currentUserId={currentUser?.id} hideHeader /></div>
        </AccordionSection>

        <AccordionSection title="Allgemeiner Chat" defaultOpen stateKey="desk_chat">
          <Communication entityType="desk" entityId="general" showHeader={false} className="h-64" />
        </AccordionSection>

        {effectiveRole !== 'guest' && (
          <AccordionSection title="Allgemeine Dateien" stateKey="desk_dateien_allgemein">
            <FileCard title="" entityType="desk" entityId="shared" category="general" maxFiles={10} maxFileSizeMB={50} canManage={isEditor} />
          </AccordionSection>
        )}

        {effectiveRole !== 'guest' && (
          <AccordionSection title="Persönliche Dateien" stateKey="desk_dateien_persoenlich">
            <FileCard title="" entityType="desk" entityId={currentUserId} category="personal" maxFiles={10} maxFileSizeMB={20} canManage={true} />
          </AccordionSection>
        )}

        <AccordionSection title="Pinnwand" stateKey="desk_pinnwand">
          <div className="p-3">
            <ContentBoard entityType="desk" entityId="notice_board" title="" isAdmin={isAdmin}
              modalTitle={{ new: 'Neue Mitteilung', edit: 'Mitteilung bearbeiten' }}
              titlePlaceholder="Titel der Mitteilung" newItemLabel="Neue Mitteilung" />
          </div>
        </AccordionSection>

        <AccordionSection title="Persönliche Notizen" defaultOpen stateKey="desk_notizen">
          <div className="p-3">
            <ContentBoard entityType="desk_personal" entityId={currentUserId} title="" isAdmin={true}
              singleItem hideHeader hideEmptyButton allowDelete={false}
              fixedTitle="Persönliche Notizen" showTitleField={false}
              modalTitle={{ new: 'Notiz bearbeiten', edit: 'Notiz bearbeiten' }}
              newItemLabel="Notiz erstellen" defaultContent={{ title: 'Persönliche Notizen', content: '' }} />
          </div>
        </AccordionSection>
      </div>

      {/* ── DESKTOP: Grid ── */}

      {/* Zeile 1: Herzlich willkommen | Offene Aufgaben | Letzte Nachrichten | Allgemeiner Chat */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">

        {/* 1 — Herzlich willkommen */}
        <div style={cardStyle}>
          <ContentBoard
            entityType="desk" entityId="announcement" title=""
            isAdmin={canDo(effectiveRole, CAN_EDIT_ANKUENDIGUNG)}
            singleItem hideEmptyButton allowDelete={false}
            modalTitle={{ new: 'Ankündigung erstellen', edit: 'Ankündigung bearbeiten' }}
            titlePlaceholder="Titel der Ankündigung" newItemLabel="Ankündigung erstellen"
            defaultContent={{ title: 'Herzlich willkommen 👋', content: 'Hier kannst du aktuelle Infos, Ankündigungen oder Hinweise für dein Team hinterlegen.' }}
            onItemLoaded={t => setAnnouncementTitle(t ?? 'Herzlich willkommen')}
            className="flex-1"
          />
        </div>

        {/* 2 — Offene Aufgaben */}
        <div style={cardStyle}>
          <GlobalTodoOverview />
        </div>

        {/* 3 — Letzte Nachrichten */}
        <div style={cardStyle}>
          <RecentChatMessages currentUserId={currentUser?.id} />
        </div>

        {/* 4 — Allgemeiner Chat */}
        <div style={cardStyle}>
          <Communication title="Allgemeiner Chat" entityType="desk" entityId="general" className="h-full" />
        </div>
      </div>

      {/* Zeile 2: Allgemeine Dateien | Persönliche Dateien | Pinnwand | Persönliche Notizen */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">

        {/* 1 — Allgemeine Dateien */}
        {effectiveRole !== 'guest' ? (
          <FileCard title="ALLGEMEINE DATEIEN" entityType="desk" entityId="shared" category="general"
            maxFiles={10} maxFileSizeMB={50} className="h-[400px]" canManage={isEditor} />
        ) : (
          <div style={cardStyle}>
            <div className="pt-card-header"><span className="pt-card-title">Allgemeine Dateien</span></div>
            <div className="flex-1 flex items-center justify-center text-sm" style={{ color: '#6b7280' }}>Kein Zugriff</div>
          </div>
        )}

        {/* 2 — Persönliche Dateien */}
        {effectiveRole !== 'guest' ? (
          <FileCard title="PERSÖNLICHE DATEIEN" entityType="desk" entityId={currentUserId} category="personal"
            maxFiles={10} maxFileSizeMB={20} className="h-[400px]" canManage={true} />
        ) : (
          <div style={cardStyle}>
            <div className="pt-card-header"><span className="pt-card-title">Persönliche Dateien</span></div>
            <div className="flex-1 flex items-center justify-center text-sm" style={{ color: '#6b7280' }}>Kein Zugriff</div>
          </div>
        )}

        {/* 3 — Pinnwand */}
        <div style={cardStyle}>
          <div className="pt-card-header">
            <span className="pt-card-title">Pinnwand</span>
          </div>
          <div className="flex-1 overflow-y-auto pt-card-body">
            <ContentBoard entityType="desk" entityId="notice_board" title="" isAdmin={isAdmin}
              modalTitle={{ new: 'Neue Mitteilung', edit: 'Mitteilung bearbeiten' }}
              titlePlaceholder="Titel der Mitteilung" newItemLabel="Neue Mitteilung" />
          </div>
        </div>

        {/* 4 — Persönliche Notizen */}
        <div style={cardStyle}>
          <ContentBoard entityType="desk_personal" entityId={currentUserId} title="" isAdmin={true}
            singleItem hideEmptyButton allowDelete={false}
            fixedTitle="Persönliche Notizen" showTitleField={false}
            modalTitle={{ new: 'Notiz bearbeiten', edit: 'Notiz bearbeiten' }}
            newItemLabel="Notiz erstellen"
            defaultContent={{ title: 'Persönliche Notizen', content: '' }}
            className="flex-1" />
        </div>
      </div>
    </>
  )
}

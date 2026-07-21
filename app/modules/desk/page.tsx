'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { Communication } from '@/app/components/shared/Communication'
import { FileCard } from '@/app/components/shared/FileCard'
import ContentBoard from '@/app/components/shared/ContentBoard'
import GlobalTodoOverview from '@/app/components/shared/GlobalTodoOverview'
import { getCurrentUser, getCurrentTenant, getMyRole, updateCurrentTenantRole, isAdminRole, isEditorRole, getEffectiveRole, can } from '@/lib/api-client'
import RecentChatMessages from '@/app/components/shared/RecentChatMessages'

type Zone = 'team' | 'personal'
const ZONE_KEY = 'desk_zone'
const TEAM_SEC_KEY = 'desk_team_sec'
const PERS_SEC_KEY = 'desk_personal_sec'

export default function SchreibtischModule() {
  const effectiveRole = getEffectiveRole()
  const isAdmin  = isAdminRole(effectiveRole)
  const isEditor = isEditorRole(effectiveRole)
  const isGuest  = effectiveRole === 'guest'
  const currentUser = getCurrentUser()
  const currentUserId = currentUser ? String(currentUser.id) : 'unknown'
  const [announcementTitle, setAnnouncementTitle] = useState('Herzlich willkommen')

  const [zone, setZone] = useState<Zone>('team')
  const [teamSec, setTeamSec] = useState('announcement')
  const [personalSec, setPersonalSec] = useState('notes')

  useEffect(() => {
    getMyRole().then(freshRole => {
      if (freshRole && freshRole !== getCurrentTenant()?.role) updateCurrentTenantRole(freshRole)
    }).catch(() => {})
    try {
      const z = localStorage.getItem(ZONE_KEY); if (z === 'team' || z === 'personal') setZone(z)
      const ts = localStorage.getItem(TEAM_SEC_KEY); if (ts) setTeamSec(ts)
      const ps = localStorage.getItem(PERS_SEC_KEY); if (ps) setPersonalSec(ps)
    } catch {}
  }, [])

  const pickZone = (z: Zone) => { setZone(z); try { localStorage.setItem(ZONE_KEY, z) } catch {} }
  const pickSection = (id: string) => {
    if (zone === 'team') { setTeamSec(id); try { localStorage.setItem(TEAM_SEC_KEY, id) } catch {} }
    else { setPersonalSec(id); try { localStorage.setItem(PERS_SEC_KEY, id) } catch {} }
  }

  const teamSections = [
    { id: 'announcement', label: 'Ankündigung' },
    { id: 'todos',        label: 'Offene Aufgaben' },
    { id: 'chat',         label: 'Chat' },
    ...(isGuest ? [] : [{ id: 'files', label: 'Allgemeine Dateien' }]),
  ]
  const personalSections = [
    { id: 'notes',    label: 'Persönliche Notizen' },
    ...(isGuest ? [] : [{ id: 'files', label: 'Persönliche Dateien' }]),
    { id: 'pinboard', label: 'Pinnwand' },
  ]

  const sections = zone === 'team' ? teamSections : personalSections
  const wanted = zone === 'team' ? teamSec : personalSec
  const activeSec = sections.some(s => s.id === wanted) ? wanted : (sections[0]?.id ?? '')

  // Wrapper für Komponenten ohne eigenes pt-card
  const Card = ({ children, h }: { children: ReactNode; h?: number }) => (
    <div className="pt-card flex flex-col" style={h ? { height: h } : { minHeight: 420 }}>{children}</div>
  )

  const renderContent = () => {
    if (zone === 'team') {
      switch (activeSec) {
        case 'announcement':
          return (
            <Card>
              <ContentBoard
                entityType="desk" entityId="announcement" title=""
                isAdmin={can('CAN_EDIT_ANKUENDIGUNG', effectiveRole)}
                singleItem hideEmptyButton allowDelete={false}
                modalTitle={{ new: 'Ankündigung erstellen', edit: 'Ankündigung bearbeiten' }}
                titlePlaceholder="Titel der Ankündigung" newItemLabel="Ankündigung erstellen"
                defaultContent={{ title: 'Herzlich willkommen 👋', content: 'Hier kannst du aktuelle Infos, Ankündigungen oder Hinweise für dein Team hinterlegen.' }}
                onItemLoaded={t => setAnnouncementTitle(t ?? 'Herzlich willkommen')}
                className="flex-1"
              />
            </Card>
          )
        case 'todos':
          return <Card><GlobalTodoOverview /></Card>
        case 'chat':
          return (
            <div className="space-y-4">
              <RecentChatMessages currentUserId={currentUser?.id} />
              <Card h={520}>
                <Communication title="Allgemeiner Chat" entityType="desk" entityId="general" className="h-full" />
              </Card>
            </div>
          )
        case 'files':
          return <FileCard title="ALLGEMEINE DATEIEN" entityType="desk" entityId="shared" category="general" maxFiles={10} maxFileSizeMB={50} className="min-h-[420px]" canManage={isEditor} />
      }
    } else {
      switch (activeSec) {
        case 'notes':
          return (
            <Card>
              <ContentBoard
                entityType="desk_personal" entityId={currentUserId} title=""
                isAdmin={true}
                singleItem hideEmptyButton allowDelete={false}
                fixedTitle="Persönliche Notizen" showTitleField={false}
                modalTitle={{ new: 'Notiz bearbeiten', edit: 'Notiz bearbeiten' }}
                newItemLabel="Notiz erstellen"
                defaultContent={{ title: 'Persönliche Notizen', content: '' }}
                className="flex-1"
              />
            </Card>
          )
        case 'files':
          return <FileCard title="PERSÖNLICHE DATEIEN" entityType="desk" entityId={currentUserId} category="personal" maxFiles={10} maxFileSizeMB={20} className="min-h-[420px]" canManage={true} />
        case 'pinboard':
          return (
            <Card>
              <div className="pt-card-header"><span className="pt-card-title">Pinnwand (privat)</span></div>
              <div className="flex-1 overflow-y-auto pt-card-body">
                <ContentBoard entityType="desk_personal" entityId={`${currentUserId}_board`} title="" isAdmin={true}
                  modalTitle={{ new: 'Neue Notiz', edit: 'Notiz bearbeiten' }}
                  titlePlaceholder="Titel" newItemLabel="Neue Notiz" />
              </div>
            </Card>
          )
      }
    }
    return null
  }

  return (
    <div className="pb-10">
      {/* Datum – linksbündig, dezent */}
      <div className="mb-3 text-sm" style={{ color: '#9ca3af' }}>
        {new Date().toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </div>

      {/* Reiter: Team / Persönlich – gleicher Stil wie Event-Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #333', overflowX: 'auto', marginBottom: '0.5rem' }}>
        <button onClick={() => pickZone('team')} className={`pt-detail-tab${zone === 'team' ? ' active' : ''}`}>Team</button>
        <button onClick={() => pickZone('personal')} className={`pt-detail-tab${zone === 'personal' ? ' active' : ''}`}>Persönlich</button>
      </div>

      {/* Submenü – wie im Event */}
      <div style={{ display: 'flex', borderBottom: '1px solid #333', overflowX: 'auto', marginBottom: '1rem' }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => pickSection(s.id)} className={`pt-detail-tab${activeSec === s.id ? ' active' : ''}`}>{s.label}</button>
        ))}
      </div>

      {/* Inhalt – volle Breite */}
      {renderContent()}
    </div>
  )
}

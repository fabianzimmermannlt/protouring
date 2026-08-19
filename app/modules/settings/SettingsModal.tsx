'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import SettingsModule from './SettingsModule'
import { getEffectiveRole, isEditorRole, type TenantRole } from '@/lib/api-client'
import { useEscapeKey } from '@/app/hooks/useEscapeKey'

// Settings als Popup-Overlay (wie Claude). Man bleibt auf der Seite, auf der man arbeitet.
// Bewusst helle Oberfläche (unabhängig vom App-Theme), damit der SettingsModule-Inhalt
// konsistent aussieht. Der alte Settings-Bereich bleibt vorerst als Fallback bestehen.

type SubItem = { id: string; name: string; editorOnly?: boolean; adminOnly?: boolean }

const KONTO: SubItem[] = [
  { id: 'profil',         name: 'Mein Profil' },
  { id: 'appearance',     name: 'Darstellung' },
  { id: 'notifications',  name: 'Benachrichtigungen' },
  { id: 'erste-schritte', name: 'Erste Schritte' },
]

const WORKSPACE: SubItem[] = [
  { id: 'artist',      name: 'Artist',           adminOnly: true },
  { id: 'permissions', name: 'Berechtigungen',   editorOnly: true },
  { id: 'roles',       name: 'Rollen & Rechte',  adminOnly: true },
  { id: 'contacts',    name: 'Kontakte',         editorOnly: true },
  { id: 'partners',    name: 'Partner',          adminOnly: true },
  { id: 'vehicles',    name: 'Fahrzeuge',        adminOnly: true },
  { id: 'gewerke',     name: 'Gewerke',          editorOnly: true },
  { id: 'uploads',     name: 'Upload-Kategorien', editorOnly: true },
  { id: 'travel',      name: 'Travel & Hotel',    adminOnly: true },
  { id: 'guestlist',   name: 'Gästeliste',       editorOnly: true },
  { id: 'songs',       name: 'Songs & Setlist',  editorOnly: true },
  { id: 'daysheet',    name: 'Daysheet',         editorOnly: true },
  { id: 'vorlagen',    name: 'Vorlagen',         editorOnly: true },
]

interface Props {
  open: boolean
  initialSubTab?: string
  onClose: () => void
}

export default function SettingsModal({ open, initialSubTab = 'profil', onClose }: Props) {
  const [subTab, setSubTab] = useState(initialSubTab)
  useEscapeKey(() => { if (open) onClose() })

  useEffect(() => { if (open) setSubTab(initialSubTab) }, [open, initialSubTab])

  if (!open) return null

  const role = getEffectiveRole() as TenantRole
  const isEditor = isEditorRole(role)
  const filter = (items: SubItem[]) =>
    items.filter(s => (s.adminOnly ? role === 'admin' : s.editorOnly ? isEditor : true))
  const konto = filter(KONTO)
  const workspace = filter(WORKSPACE)

  const railButton = (s: SubItem) => (
    <button
      key={s.id}
      onClick={() => setSubTab(s.id)}
      className={`w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors ${
        subTab === s.id ? 'bg-blue-600 text-white font-medium' : 'text-gray-700 hover:bg-gray-200 hover:text-gray-900'
      }`}
    >
      {s.name}
    </button>
  )

  const groupTitle = (txt: string) => (
    <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{txt}</p>
  )

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', zIndex: 9998 }}
      onClick={onClose}
    >
      <div
        className="pt-settings-modal bg-white rounded-xl shadow-2xl flex overflow-hidden"
        style={{ width: 'min(1080px, 95vw)', height: 'min(85vh, 780px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Linke Navigationsleiste */}
        <div className="w-56 shrink-0 bg-gray-50 border-r border-gray-200 overflow-y-auto py-3 px-2">
          <div className="px-3 pb-1 text-base font-semibold text-gray-900">Einstellungen</div>
          {konto.length > 0 && <>{groupTitle('Konto')}<div className="space-y-0.5">{konto.map(railButton)}</div></>}
          {workspace.length > 0 && <>{groupTitle('Workspace')}<div className="space-y-0.5">{workspace.map(railButton)}</div></>}
        </div>

        {/* Inhalt — gleiche Umgebung wie L2-Content (Venues/Details), damit alle Bereiche einheitlich theme'n */}
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--pane)] relative">
          <button onClick={onClose} className="absolute top-4 right-4 z-10 p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-[var(--surface)]">
            <X className="w-5 h-5" />
          </button>
          <div className="l2-content flex-1 overflow-y-auto p-6">
            <SettingsModule activeSubTab={subTab} />
          </div>
        </div>
      </div>
    </div>
  )
}

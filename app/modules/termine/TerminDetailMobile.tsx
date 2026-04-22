'use client'

import { useState } from 'react'
import { Edit2 } from 'lucide-react'
import AnreiseCard from './AnreiseCard'
import HotelCard from './HotelCard'
import LokaleKontakteCard from './LokaleKontakteCard'
import ZeitplaeneCard from './ZeitplaeneCard'
import CateringCard from './CateringCard'
import TerminChatCard from './TerminChatCard'
import TerminFileCard from './TerminFileCard'
import ToDoCard from './ToDoCard'
import ContentBoard from '@/app/components/shared/ContentBoard'
import { getCurrentUser } from '@/lib/api-client'
import type { Termin } from '@/lib/api-client'
import { AccordionSection as Section } from '@/app/components/shared/AccordionSection'

// ── Status badges ──────────────────────────────────────────────

const STATUS_BOOKING_COLOR: Record<string, string> = {
  'Idee':                 'badge badge-gray',
  'Option':               'badge badge-yellow',
  'noch nicht bestätigt': 'badge badge-orange',
  'bestätigt':            'badge badge-green',
  'abgeschlossen':        'badge badge-blue',
  'abgesagt':             'badge badge-red',
}

const STATUS_PUBLIC_COLOR: Record<string, string> = {
  'nicht öffentlich': 'badge badge-gray',
  'tba':              'badge badge-yellow',
  'veröffentlicht':   'badge badge-green',
}

function formatDateLong(d: string) {
  return new Date(d).toLocaleDateString('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ── Main component ─────────────────────────────────────────────

interface Props {
  termin: Termin
  termine: Termin[]
  isAdmin: boolean
  canSeeFiles: boolean
  onUpdated: (t: Termin) => void
  onDeleted: () => void
  onEditClick: () => void
}

export default function TerminDetailMobile({
  termin,
  isAdmin,
  canSeeFiles,
  onEditClick,
}: Props) {
  const currentUser = getCurrentUser()
  const currentUserId = currentUser ? String(currentUser.id) : 'unknown'

  const locationLabel = [termin.city, termin.venueName].filter(Boolean).join(' · ')
  const pageTitle = termin.showTitleAsHeader ? termin.title : locationLabel || termin.title

  const [abreiseRefreshKey, setAbreiseRefreshKey] = useState(0)
  const [anreiseRefreshKey, setAnreiseRefreshKey] = useState(0)

  return (
    <div className="flex flex-col gap-2 pb-4">

      {/* ── Hero header ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-gray-400 mb-0.5">{formatDateLong(termin.date)}</p>
            <p className="text-base font-semibold text-gray-900 leading-snug truncate">{pageTitle}</p>
          </div>
          {isAdmin && (
            <button
              onClick={onEditClick}
              className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Edit2 size={15} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {termin.statusBooking && (
            <span className={STATUS_BOOKING_COLOR[termin.statusBooking] || 'badge badge-gray'}>
              {termin.statusBooking}
            </span>
          )}
          {termin.statusPublic && (
            <span className={STATUS_PUBLIC_COLOR[termin.statusPublic] || 'badge badge-gray'}>
              {termin.statusPublic}
            </span>
          )}
          {termin.art && (
            <span className="badge badge-gray">
              {termin.art}{termin.artSub ? ` · ${termin.artSub}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* ── 1. Reise & Hotel ────────────────────────────── */}
      <Section title="Reise & Hotel" defaultOpen stateKey="termin_reise">
        <AnreiseCard
          terminId={termin.id}
          legType="anreise"
          isAdmin={isAdmin}
          terminDate={termin.date}
          terminCity={termin.city || ''}
          refreshKey={anreiseRefreshKey}
          onCopiedToAbreise={() => setAbreiseRefreshKey(k => k + 1)}
        />
        <div className="border-t border-gray-100">
          <HotelCard
            terminId={termin.id}
            isAdmin={isAdmin}
            terminDate={termin.date}
          />
        </div>
        <div className="border-t border-gray-100">
          <AnreiseCard
            terminId={termin.id}
            legType="abreise"
            isAdmin={isAdmin}
            terminDate={termin.date}
            terminCity={termin.city || ''}
            refreshKey={abreiseRefreshKey}
            onLegDeleted={() => setAnreiseRefreshKey(k => k + 1)}
          />
        </div>
      </Section>

      {/* ── 2. Zeitplan ─────────────────────────────────── */}
      <Section title="Zeitplan" defaultOpen stateKey="termin_zeitplan">
        <ZeitplaeneCard terminId={termin.id} isAdmin={isAdmin} />
      </Section>

      {/* ── 3. Catering ─────────────────────────────────── */}
      <Section title="Catering" defaultOpen stateKey="termin_catering">
        <CateringCard terminId={termin.id} isAdmin={isAdmin} />
      </Section>

      {/* ── 4. Spielstätte & Partner ────────────────────── */}
      <Section title="Spielstätte & Partner" stateKey="termin_spielstaette">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm px-4 py-3">
          <dt className="text-gray-400 font-medium">Spielstätte</dt>
          <dd className="text-gray-800">{termin.venueName || <span className="text-gray-300">–</span>}</dd>
          {termin.city && (
            <>
              <dt className="text-gray-400 font-medium">Ort</dt>
              <dd className="text-gray-800">{termin.city}</dd>
            </>
          )}
          <dt className="text-gray-400 font-medium">Partner</dt>
          <dd className="text-gray-800">{termin.partnerName || <span className="text-gray-300">–</span>}</dd>
        </dl>
      </Section>

      {/* ── 5. Lokale Kontakte ──────────────────────────── */}
      <Section title="Lokale Kontakte" stateKey="termin_kontakte">
        <LokaleKontakteCard terminId={termin.id} isAdmin={isAdmin} />
      </Section>

      {/* ── 6. Aufgaben ─────────────────────────────────── */}
      <Section title="Aufgaben" defaultOpen stateKey="termin_aufgaben">
        <ToDoCard terminId={termin.id} />
      </Section>

      {/* ── 7. Dateien ──────────────────────────────────── */}
      {canSeeFiles && (
        <Section title="Dateien" stateKey="termin_dateien">
          <TerminFileCard terminId={String(termin.id)} />
        </Section>
      )}

      {/* ── 8. Chat ─────────────────────────────────────── */}
      <Section title="Chat" stateKey="termin_chat">
        <TerminChatCard terminId={termin.id} />
      </Section>

      {/* ── 9. Private Notiz ────────────────────────────── */}
      <Section title="Private Notiz" stateKey="termin_notiz">
        <div className="p-3">
          <ContentBoard
            entityType="termin_private"
            entityId={`${termin.id}_${currentUserId}`}
            title=""
            isAdmin
            singleItem
            fixedTitle="Private Notiz"
            showTitleField={false}
            modalTitle={{ new: 'Notiz bearbeiten', edit: 'Notiz bearbeiten' }}
            hideEmptyButton
            allowDelete={false}
          />
        </div>
      </Section>

    </div>
  )
}

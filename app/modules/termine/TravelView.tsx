'use client'

import { useState } from 'react'
import AnreiseCard from './AnreiseCard'
import HotelCard from './HotelCard'
import { type Termin } from '@/lib/api-client'

interface TravelViewProps {
  termin: Termin
  termine: Termin[]
  isAdmin: boolean
}

export default function TravelView({ termin, termine, isAdmin }: TravelViewProps) {
  const [abreiseRefreshKey, setAbreiseRefreshKey] = useState(0)
  const [anreiseRefreshKey, setAnreiseRefreshKey] = useState(0)

  const ONE_DAY_MS = 86400000
  const idx = termine.findIndex(item => item.id === termin.id)
  const prevTermin = idx > 0 ? termine[idx - 1] : null
  const nextTermin = idx < termine.length - 1 ? termine[idx + 1] : null
  const prevTerminCity: string | undefined =
    prevTermin?.date && termin.date &&
    new Date(termin.date).getTime() - new Date(prevTermin.date).getTime() === ONE_DAY_MS
      ? (prevTermin.city || undefined) : undefined
  const nextTerminCity: string | undefined =
    nextTermin?.date && termin.date &&
    new Date(nextTermin.date).getTime() - new Date(termin.date).getTime() === ONE_DAY_MS
      ? (nextTermin.city || undefined) : undefined

  return (
    <div className="grid grid-cols-3 gap-4">
      <AnreiseCard
        terminId={termin.id}
        legType="anreise"
        isAdmin={isAdmin}
        terminDate={termin.date}
        terminCity={termin.city || ''}
        prevTerminCity={prevTerminCity}
        refreshKey={anreiseRefreshKey}
        onCopiedToAbreise={() => setAbreiseRefreshKey(k => k + 1)}
      />
      <HotelCard
        terminId={termin.id}
        isAdmin={isAdmin}
        terminDate={termin.date}
      />
      <AnreiseCard
        terminId={termin.id}
        legType="abreise"
        isAdmin={isAdmin}
        terminDate={termin.date}
        terminCity={termin.city || ''}
        nextTerminCity={nextTerminCity}
        refreshKey={abreiseRefreshKey}
        onLegDeleted={() => setAnreiseRefreshKey(k => k + 1)}
      />
    </div>
  )
}

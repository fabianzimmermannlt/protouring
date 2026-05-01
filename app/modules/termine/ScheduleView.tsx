'use client'

import ZeitplaeneCard from './ZeitplaeneCard'

interface ScheduleViewProps {
  terminId: number
  isAdmin: boolean
}

export default function ScheduleView({ terminId, isAdmin }: ScheduleViewProps) {
  return <ZeitplaeneCard terminId={terminId} isAdmin={isAdmin} layout="grid-2" />
}

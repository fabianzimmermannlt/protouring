'use client'

import ZeitplaeneCard from './ZeitplaeneCard'

interface ScheduleViewProps {
  terminId: number
  isAdmin: boolean
}

export default function ScheduleView({ terminId, isAdmin }: ScheduleViewProps) {
  return (
    <div className="max-w-3xl">
      <ZeitplaeneCard terminId={terminId} isAdmin={isAdmin} />
    </div>
  )
}

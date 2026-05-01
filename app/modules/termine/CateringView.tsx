'use client'

import CateringCard from './CateringCard'

interface CateringViewProps {
  terminId: number
  isAdmin: boolean
}

export default function CateringView({ terminId, isAdmin }: CateringViewProps) {
  return (
    <div className="max-w-3xl">
      <CateringCard terminId={terminId} isAdmin={isAdmin} />
    </div>
  )
}

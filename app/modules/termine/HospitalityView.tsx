'use client'

import CateringCard from './CateringCard'

interface HospitalityViewProps {
  terminId: number
  isAdmin: boolean
}

export default function HospitalityView({ terminId, isAdmin }: HospitalityViewProps) {
  return (
    <div className="max-w-3xl">
      <CateringCard terminId={terminId} isAdmin={isAdmin} />
    </div>
  )
}

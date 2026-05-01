'use client'

import AdvancingCard from './AdvancingCard'

interface AgreementsViewProps {
  terminId: number
  isAdmin: boolean
}

export default function AgreementsView({ terminId, isAdmin }: AgreementsViewProps) {
  return (
    <div className="max-w-3xl">
      <AdvancingCard terminId={terminId} isAdmin={isAdmin} />
    </div>
  )
}

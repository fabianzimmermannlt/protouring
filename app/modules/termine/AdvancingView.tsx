'use client'

import AdvancingCard from './AdvancingCard'

interface AdvancingViewProps {
  terminId: number
  isAdmin: boolean
}

export default function AdvancingView({ terminId, isAdmin }: AdvancingViewProps) {
  return (
    <div className="max-w-4xl">
      <AdvancingCard terminId={terminId} isAdmin={isAdmin} />
    </div>
  )
}

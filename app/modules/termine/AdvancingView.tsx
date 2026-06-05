'use client'

import AdvancingCard from './AdvancingCard'
import TerminFileCard from './TerminFileCard'

interface AdvancingViewProps {
  terminId: number
  isAdmin: boolean
}

export default function AdvancingView({ terminId, isAdmin }: AdvancingViewProps) {
  return (
    <div className="flex flex-col gap-4" style={{ maxWidth: '1200px' }}>
      <AdvancingCard terminId={terminId} isAdmin={isAdmin} />
      <TerminFileCard terminId={String(terminId)} />
    </div>
  )
}

'use client'

import AdvancingCard from './AdvancingCard'
import TerminFileCard from './TerminFileCard'

interface AdvancingViewProps {
  terminId: number
  isAdmin: boolean
}

export default function AdvancingView({ terminId, isAdmin }: AdvancingViewProps) {
  return (
    <div className="grid grid-cols-3 gap-4 items-start" style={{ maxWidth: '1200px' }}>
      <div className="col-span-2">
        <AdvancingCard terminId={terminId} isAdmin={isAdmin} />
      </div>
      <TerminFileCard terminId={String(terminId)} />
    </div>
  )
}

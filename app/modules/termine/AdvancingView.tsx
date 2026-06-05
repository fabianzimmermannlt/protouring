'use client'

import AdvancingCard from './AdvancingCard'
import TerminFileCard from './TerminFileCard'
import ToDoCard from './ToDoCard'

interface AdvancingViewProps {
  terminId: number
  isAdmin: boolean
}

export default function AdvancingView({ terminId, isAdmin }: AdvancingViewProps) {
  return (
    <div className="flex flex-col gap-4" style={{ maxWidth: '1200px' }}>
      <ToDoCard terminId={terminId} />
      <AdvancingCard terminId={terminId} isAdmin={isAdmin} />
      <TerminFileCard terminId={String(terminId)} />
    </div>
  )
}

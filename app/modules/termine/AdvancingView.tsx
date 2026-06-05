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
      <div className="grid grid-cols-3 gap-4 items-start">
        <div className="col-span-2">
          <AdvancingCard terminId={terminId} isAdmin={isAdmin} />
        </div>
        <ToDoCard terminId={terminId} />
      </div>
      <TerminFileCard terminId={String(terminId)} />
    </div>
  )
}

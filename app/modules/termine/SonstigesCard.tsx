'use client'

import ContentBoard from '@/app/components/shared/ContentBoard'

export default function SonstigesCard({ terminId, isAdmin }: { terminId: number; isAdmin: boolean }) {
  return (
    <ContentBoard
      entityType="termin_sonstiges"
      entityId={String(terminId)}
      title=""
      isAdmin={isAdmin}
      newItemLabel="Neuer Eintrag"
      modalTitle={{ new: 'Neuer Eintrag', edit: 'Eintrag bearbeiten' }}
      titlePlaceholder="Titel"
    />
  )
}

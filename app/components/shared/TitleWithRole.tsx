'use client'

// Geteilte Titelzeile: Name, dahinter eine Rollen-Bubble. App-weit identisch
// (Booking-Parteien, Event-Partner usw.), damit die Darstellung konsistent ist.
export function TitleWithRole({ name, role }: { name?: string | null; role?: string | null }) {
  return (
    <span className="truncate inline-flex items-center gap-2">
      <span className="font-medium" style={{ color: 'var(--text)' }}>{name || '—'}</span>
      {role && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5" style={{ background: 'var(--hover)', color: 'var(--text-muted)' }}>{role}</span>
      )}
    </span>
  )
}

export default TitleWithRole

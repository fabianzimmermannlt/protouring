'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useT } from '@/app/lib/i18n/LanguageContext'

interface QuickCreateModalProps {
  title: string
  onClose: () => void
  onSubmit: () => void
  submitLabel?: string
  submitting?: boolean
  disabled?: boolean
  error?: string
  children: React.ReactNode
}

export function QuickCreateModal({
  title,
  onClose,
  onSubmit,
  submitLabel,
  submitting = false,
  disabled = false,
  error,
  children,
}: QuickCreateModalProps) {
  const t = useT()

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-overlay">
      {/* Kompakte Variante des Standard-Modals mit den globalen Modal- und Formular-Klassen */}
      <div className="modal-container max-w-[420px]">
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-[var(--text)]"
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {error && (
            <div className="text-xs" style={{ color: 'var(--neg)', background: 'var(--danger-soft)', border: '1px solid var(--danger)', padding: '8px 12px' }}>{error}</div>
          )}
          {children}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onClose} className="btn btn-ghost">{t('general.cancel')}</button>
          <button
            onClick={onSubmit}
            disabled={disabled || submitting}
            className="btn btn-primary"
            style={{ opacity: disabled || submitting ? 0.5 : 1, cursor: disabled || submitting ? 'not-allowed' : 'pointer' }}
          >
            {submitting ? t('general.creating') : (submitLabel ?? t('general.create'))}
          </button>
        </div>
      </div>
    </div>
  )
}

// Reusable field components – nutzen die globalen Formular-Klassen
export function QField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="form-label">
        {label}{required && <span className="req-star" style={{ marginLeft: '2px' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

export const inputCls = 'form-input'
export const selectCls = 'form-select'

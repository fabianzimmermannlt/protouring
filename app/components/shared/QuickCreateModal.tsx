'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useT } from '@/app/lib/i18n/LanguageContext'
import { useLayout } from '@/app/components/shared/Navigation/LayoutContext'

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
  const { layout } = useLayout()
  const dark = layout === 'L2'

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const bg = dark ? '#2d2d2d' : '#ffffff'
  const border = dark ? '#4a4a4a' : '#e5e7eb'
  const titleColor = dark ? '#e0e0e0' : '#111827'
  const labelColor = dark ? '#b0b0b0' : '#4b5563'
  const bodyBg = dark ? '#2d2d2d' : '#ffffff'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div style={{ background: bg, borderRadius: '6px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', width: '100%', maxWidth: '420px', border: `1px solid ${border}`, ['--qf-label' as string]: dark ? '#b0b0b0' : '#4b5563', ['--qf-input-bg' as string]: dark ? '#3c3c3c' : '#fff', ['--qf-input-border' as string]: dark ? '#555' : '#d1d5db', ['--qf-input-color' as string]: dark ? '#e0e0e0' : '#111827' } as React.CSSProperties}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${border}` }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: titleColor, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ color: labelColor, background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className={dark ? 'qcm-body qcm-dark' : 'qcm-body'} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', background: bodyBg }}>
          {error && (
            <div style={{ fontSize: '12px', color: '#f87171', background: dark ? '#3d1f1f' : '#fef2f2', border: `1px solid ${dark ? '#7f1d1d' : '#fecaca'}`, borderRadius: '4px', padding: '8px 12px' }}>{error}</div>
          )}
          {children}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '14px 20px', borderTop: `1px solid ${border}` }}>
          <button
            onClick={onClose}
            style={{ padding: '7px 14px', fontSize: '13px', color: labelColor, background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
          >
            {t('general.cancel')}
          </button>
          <button
            onClick={onSubmit}
            disabled={disabled || submitting}
            style={{ padding: '7px 14px', fontSize: '13px', fontWeight: 500, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: disabled || submitting ? 'not-allowed' : 'pointer', opacity: disabled || submitting ? 0.5 : 1 }}
          >
            {submitting ? t('general.creating') : (submitLabel ?? t('general.create'))}
          </button>
        </div>
      </div>
    </div>
  )
}

// Reusable field components
export function QField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="qfield-label block text-xs font-medium mb-1" style={{ color: 'var(--qf-label, #4b5563)' }}>{label}</label>
      {children}
    </div>
  )
}

export const inputCls = 'qfield-input w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'
export const selectCls = 'qfield-input w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'

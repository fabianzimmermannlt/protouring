'use client'

import { LayoutProvider, useLayout } from './Navigation/LayoutContext'
import { LanguageProvider } from '@/app/lib/i18n/LanguageContext'
import { L2Layout } from './Navigation/L2Layout'
import { L3Layout } from './Navigation/L3Layout'
import { Navigation } from './Navigation'
import { MobileBottomNav } from './Navigation/MobileBottomNav'
import { FeedbackButton } from './FeedbackButton'
import { getEffectiveRole, getCurrentUser } from '@/lib/api-client'

interface AppShellProps {
  children: React.ReactNode
  activeTab: string
  onTabChange: (tab: string, sub?: string) => void
  activeSubTab?: string
  onSubTabChange?: (sub: string) => void
}

function AppShellInner({ children, activeTab, onTabChange, activeSubTab = '', onSubTabChange }: AppShellProps) {
  const { layout } = useLayout()
  const role = getEffectiveRole()
  const currentUser = getCurrentUser()
  const isSuperadmin = Boolean((currentUser as any)?.isSuperadmin)

  const useL2 = layout === 'L2' && role === 'admin'
  const useL3 = layout === 'L3' && role === 'admin'

  const handleSubTabChange = onSubTabChange ?? (() => {})

  const handleTabChange = (tab: string, sub?: string) => {
    onTabChange(tab, sub)
    if (sub) handleSubTabChange(sub)
  }

  return (
    <>
      {/* ── MOBILE ── */}
      <div className="md:hidden flex flex-col bg-gray-100" style={{ height: 'calc(100dvh - var(--pt-preview-height, 0px))' }}>
        <Navigation
          activeTab={activeTab}
          onTabChange={tab => onTabChange(tab)}
          activeSubTab={activeSubTab}
          onSubTabChange={handleSubTabChange}
          showMobileNavigation={true}
        />
        <div className="flex-1 overflow-y-auto">
          <div className="px-2 py-2">{children}</div>
        </div>
        <FeedbackButton />
        <MobileBottomNav
          activeTab={activeTab}
          onTabChange={tab => onTabChange(tab)}
          isSuperadmin={isSuperadmin}
        />
      </div>

      {/* ── DESKTOP L1 ── */}
      {!useL2 && !useL3 && (
        <main className="hidden md:block min-h-screen bg-gray-100">
          <Navigation
            activeTab={activeTab}
            onTabChange={tab => onTabChange(tab)}
            activeSubTab={activeSubTab}
            onSubTabChange={handleSubTabChange}
            showMobileNavigation={false}
          />
          <FeedbackButton />
          <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-white rounded-lg shadow-lg p-4">
              <div className="bg-gray-50 rounded-lg p-4 min-h-[600px]">
                {children}
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ── DESKTOP L2 ── */}
      {useL2 && (
        <div className="hidden md:block">
          <L2Layout
            activeTab={activeTab}
            activeSubTab={activeSubTab}
            onTabChange={handleTabChange}
            onSubTabChange={handleSubTabChange}
          >
            <FeedbackButton />
            {children}
          </L2Layout>
        </div>
      )}

      {/* ── DESKTOP L3 ── */}
      {useL3 && (
        <div className="hidden md:block">
          <L3Layout
            activeTab={activeTab}
            activeSubTab={activeSubTab}
            onTabChange={handleTabChange}
            onSubTabChange={handleSubTabChange}
          >
            <FeedbackButton />
            {children}
          </L3Layout>
        </div>
      )}
    </>
  )
}

export function AppShell(props: AppShellProps) {
  return (
    <LanguageProvider>
      <LayoutProvider>
        <AppShellInner {...props} />
      </LayoutProvider>
    </LanguageProvider>
  )
}

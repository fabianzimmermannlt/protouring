'use client'

export interface SubNavigationProps {
  activeTab?: string
  parentTab?: string
  onTabChange?: (tabId: string) => void
  maxWidth?: string
}

const equipmentSubItems = [
  { id: 'items',        name: 'GEGENSTÄNDE',  description: 'Cases & Equipment-Gegenstände' },
  { id: 'materials',    name: 'MATERIAL',     description: 'Material & Carnet-Einträge' },
  { id: 'categories',   name: 'KATEGORIEN',   description: 'Kategorien verwalten' },
  { id: 'eigentuemer',  name: 'EIGENTÜMER',   description: 'Equipment-Eigentümer' },
  { id: 'carnets',      name: 'CARNETS',      description: 'Carnet ATA Dokumente' },
]

const SHORT_LABEL: Record<string, string> = {
  items:       'Gegenstände',
  materials:   'Material',
  categories:  'Kategorien',
  eigentuemer: 'Eigentümer',
  carnets:     'Carnets',
}

export function EquipmentSubNavigation({
  activeTab = 'items',
  parentTab = 'equipment',
  onTabChange,
  maxWidth = 'max-w-full'
}: SubNavigationProps) {
  if (parentTab !== 'equipment') return null

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block pt-subnav">
        <div className={`${maxWidth} mx-auto px-4 sm:px-6 lg:px-8`}>
          <div className="pt-subnav-inner">
            {equipmentSubItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onTabChange?.(item.id)}
                className={`pt-subnav-btn${activeTab === item.id ? ' active' : ''}`}
                title={item.description}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Mobile Chips */}
      <div className="md:hidden pt-chips">
        {equipmentSubItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange?.(item.id)}
            className={`pt-chip${activeTab === item.id ? ' active' : ''}`}
          >
            {SHORT_LABEL[item.id] ?? item.name}
          </button>
        ))}
      </div>
    </>
  )
}

export default EquipmentSubNavigation

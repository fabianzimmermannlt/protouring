# Navigation Komponente

## 🎯 Zweck
Wiederverwendbare Navigation für die ProTouring Anwendung mit konsistentem Design.

## 📋 Features
- **Desktop & Mobile** - Responsive Navigation
- **Konsistentes Design** - Editor-Farben (bg-gray-900, text-white)
- **Flexibel** - Anpassbare Breite und Callbacks
- **TypeScript** - Voll typisiert

## 🎨 Design
- **Header:** `bg-gray-900 text-white` (wie ProfileEditor)
- **Aktiver Tab:** `bg-blue-600 text-white`
- **Inaktiver Tab:** `text-gray-300 hover:text-white hover:bg-gray-800`
- **Mobile:** Horizontales Scrollen bei kleinen Bildschirmen

## 🔧 Verwendung

### Basic Usage
```tsx
import { Navigation } from '@/app/components/shared/Navigation'

<Navigation />
```

### Mit Callback
```tsx
<Navigation 
  activeTab="appointments"
  onTabChange={(tabId) => console.log('Tab changed:', tabId)}
/>
```

### Angepasste Breite
```tsx
<Navigation 
  maxWidth="max-w-6xl"
  showMobileNavigation={false}
/>
```

## 📱 Responsive
- **Desktop:** Normale Navigation mit Hover-Effekten
- **Mobile:** Horizontale Navigation mit Scrollen
- **Tablet:** Automatische Umschaltung

## 🎯 Navigation Items
- SCHREIBTISCH (desk)
- TERMINE (appointments)
- KONTAKTE (contacts)
- ÜBER UNS (about)
- HOTELS (hotels)
- FAHRZEUGE (vehicles)
- LOCATIONS (venues)
- VORLAGEN (templates)
- EINSTELLUNGEN (settings)

## 🔗 Integration
Die Komponente ist perfekt für:
- Hauptseiten mit Tab-Navigation
- Admin-Dashboards
- Multi-Page Anwendungen

## 📝 Props
- `activeTab?: string` - Aktiver Tab (default: 'desk')
- `onTabChange?: (tabId: string) => void` - Callback bei Tab-Wechsel
- `maxWidth?: string` - Maximale Breite (default: 'max-w-full')
- `showMobileNavigation?: boolean` - Mobile Navigation anzeigen (default: true)

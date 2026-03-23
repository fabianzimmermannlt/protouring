# DataTable Komponente

Eine wiederverwendbare Tabellen-Komponente mit CRUD-Operationen, CSV-Import/Export und localStorage Persistenz.

## 🎯 Features

- ✅ **CRUD-Operationen** - Einträge erstellen, bearbeiten, löschen
- ✅ **CSV Import/Export** - Deutsche Semikolon-Trennung mit UTF-8 BOM
- ✅ **LocalStorage Persistenz** - Daten bleiben nach Seitenreload erhalten
- ✅ **Responsive Design** - Mobile-first mit Tailwind CSS
- ✅ **Konsistentes Design** - Passend zum restlichen Design-System
- ✅ **TypeScript** - Voll typisiert mit Interfaces
- ✅ **Flexibel** - Anpassbare Spalten und Aktionen

## 📁 Struktur

```
components/shared/DataTable/
├── index.tsx          ← Hauptkomponente
├── DataTable.tsx      ← Export-Datei
└── README.md          ← Dokumentation
```

## 🚀 Verwendung

### Basic Usage
```tsx
import { DataTable } from '@/components/shared/DataTable'

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'E-Mail' },
  { key: 'phone', label: 'Telefon' }
]

const data = [
  { id: '1', name: 'Max Mustermann', email: 'max@test.de', phone: '0123456789' }
]

export default function MyPage() {
  return (
    <DataTable
      title="Kontakte"
      columns={columns}
      data={data}
    />
  )
}
```

### Advanced Usage
```tsx
import { DataTable, DataTableItem } from '@/components/shared/DataTable'

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'E-Mail' },
  { 
    key: 'website', 
    label: 'Website',
    render: (value) => (
      <a 
        href={value} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800"
      >
        {value.replace('https://www.', '').replace('https://', '').split('/')[0]}
      </a>
    )
  }
]

const renderActions = (item: DataTableItem) => (
  <>
    <button className="text-blue-600 hover:text-blue-800">
      <Edit className="h-4 w-4" />
    </button>
    <button className="text-red-600 hover:text-red-800">
      <Trash2 className="h-4 w-4" />
    </button>
  </>
)

export default function MyPage() {
  const [data, setData] = useState([])

  return (
    <DataTable
      title="Kontakte"
      columns={columns}
      data={data}
      onDataChange={setData}
      renderActions={renderActions}
      storageKey="contacts"
      enableExport={true}
      enableImport={true}
      enableEdit={false}
      enableDelete={false}
    />
  )
}
```

## 📋 Props

| Prop | Typ | Default | Beschreibung |
|------|-----|---------|-------------|
| `title` | `string` | `"Daten"` | Titel der Komponente |
| `className` | `string` | `""` | Zusätzliche CSS-Klassen |
| `maxHeight` | `string` | `"h-[600px]"` | Maximale Höhe |
| `enableExport` | `boolean` | `true` | CSV-Export aktivieren |
| `enableImport` | `boolean` | `true` | CSV-Import aktivieren |
| `enableEdit` | `boolean` | `true` | Bearbeiten aktivieren |
| `enableDelete` | `boolean` | `true` | Löschen aktivieren |
| `storageKey` | `string` | - | localStorage Key für Persistenz |
| `columns` | `DataTableColumn[]` | **Erforderlich** | Spalten-Konfiguration |
| `data` | `DataTableItem[]` | **Erforderlich** | Tabellendaten |
| `onItemSelect` | `(item: DataTableItem) => void` | - | Callback bei Zeilen-Klick |
| `onDataChange` | `(data: DataTableItem[]) => void` | - | Callback bei Daten-Änderung |
| `renderActions` | `(item: DataTableItem) => React.ReactNode` | - | Eigene Aktionen-Render-Funktion |

## 🏗️ Interfaces

### DataTableItem
```tsx
interface DataTableItem {
  id: string
  [key: string]: any
}
```

### DataTableColumn
```tsx
interface DataTableColumn {
  key: string
  label: string
  sortable?: boolean
  render?: (value: any, item: DataTableItem) => React.ReactNode
}
```

### DataTableProps
```tsx
interface DataTableProps {
  title?: string
  className?: string
  maxHeight?: string
  enableExport?: boolean
  enableImport?: boolean
  enableEdit?: boolean
  enableDelete?: boolean
  storageKey?: string
  columns: DataTableColumn[]
  data: DataTableItem[]
  onItemSelect?: (item: DataTableItem) => void
  onDataChange?: (data: DataTableItem[]) => void
  renderActions?: (item: DataTableItem) => React.ReactNode
}
```

## 📊 CSV Format

**Export/Import verwendet deutsches CSV-Format:**
- **Trennzeichen:** Semikolon (`;`)
- **Encoding:** UTF-8 mit BOM (für Excel-Kompatibilität)
- **Sonderzeichen:** ß, ü, ö, ä werden korrekt dargestellt

**Beispiel CSV:**
```csv
Name;E-Mail;Telefon
"Max Mustermann";"max@test.de";"0123456789"
"Erika Mustermann";"erika@test.de";"0987654321"
```

## 🎨 Design-System

Die Komponente folgt dem konsistenten Design-System:

### Header
```tsx
className="bg-gray-900 text-white px-6 py-4"
```

### Labels
```tsx
className="block text-xs font-medium text-gray-700 mb-1"
```

### Input-Felder
```tsx
className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
```

### Buttons
- **Primary:** `bg-blue-600 text-white`
- **Success:** `bg-green-600 text-white`
- **Danger:** `bg-red-600 text-white`

## 🔧 Technische Details

### State Management
- **React Hooks:** `useState`, `useEffect`
- **LocalStorage:** Automatische Persistenz
- **TypeScript:** Voll typisiert

### CSV-Verarbeitung
- **BOM:** `\uFEFF` für Excel-Kompatibilität
- **Semikolon:** Deutsche CSV-Standards
- **Quoting:** `"Wert"` für Sonderzeichen

### Responsive Design
- **Table:** `overflow-x-auto` für mobile Ansicht
- **Modal:** `max-w-2xl max-h-[90vh]`
- **Grid:** `space-y-3` für Felder

## 🎯 Best Practices

### Spalten-Konfiguration
```tsx
const columns = [
  { key: 'name', label: 'Name' },
  { 
    key: 'status', 
    label: 'Status',
    render: (value) => (
      <span className={`px-2 py-1 rounded text-xs ${
        value === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}>
        {value}
      </span>
    )
  }
]
```

### Custom Actions
```tsx
const renderActions = (item) => (
  <div className="flex gap-2">
    <button onClick={() => viewDetails(item.id)}>Details</button>
    <button onClick={() => editItem(item.id)}>Bearbeiten</button>
  </div>
)
```

### Storage Key
```tsx
// Eindeutige Keys für verschiedene Anwendungen
<DataTable storageKey="contacts" />
<DataTable storageKey="products" />
<DataTable storageKey="orders" />
```

## 🚀 Use Cases

### Kontakt-Management
```tsx
const contactColumns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'E-Mail' },
  { key: 'phone', label: 'Telefon' },
  { key: 'company', label: 'Firma' }
]
```

### Produkt-Liste
```tsx
const productColumns = [
  { key: 'name', label: 'Produkt' },
  { key: 'price', label: 'Preis' },
  { key: 'stock', label: 'Lagerbestand' },
  { 
    key: 'status', 
    label: 'Status',
    render: (value) => value === 'available' ? '✅' : '❌'
  }
]
```

### Aufgaben-Verwaltung
```tsx
const taskColumns = [
  { key: 'title', label: 'Aufgabe' },
  { key: 'priority', label: 'Priorität' },
  { key: 'dueDate', label: 'Fällig' },
  { key: 'assignee', label: 'Zuständig' }
]
```

## 🎉 Vorteile

- **Wiederverwendbar** - In jedem Projekt einsetzbar
- **Konsistent** - Passend zum Design-System
- **Feature-reich** - CRUD, Import/Export, Persistenz
- **Typsicher** - Vollständige TypeScript-Unterstützung
- **Responsive** - Mobile-first Design
- **Flexibel** - Anpassbare Spalten und Aktionen

## 📝 Beispiele

### Minimal Setup
```tsx
<DataTable columns={columns} data={data} />
```

### Konfiguriert
```tsx
<DataTable 
  title="Kunden"
  columns={columns}
  data={customers}
  enableDelete={false}
  storageKey="customers"
  maxHeight="h-[500px]"
/>
```

### Mit Callbacks
```tsx
<DataTable
  columns={columns}
  data={data}
  onItemSelect={(item) => navigate(`/details/${item.id}`)}
  onDataChange={(data) => console.log('Updated:', data.length)}
/>
```

### Mit Custom Actions
```tsx
<DataTable
  columns={columns}
  data={data}
  renderActions={(item) => (
    <button onClick={() => exportItem(item)}>Export</button>
  )}
/>
```

Die DataTable Komponente ist die perfekte wiederverwendbare Lösung für alle Tabellen-Bedürfnisse in deinem Projekt!

# FormEditor Komponente

Eine universelle, wiederverwendbare Formular-Komponente für alle Dateneingabe-Modal-Dialoge.

## Features

- **Flexible Feldtypen** - Text, Email, Datum, Select, Checkbox, etc.
- **Sektionen** - Gruppierung von Feldern in Abschnitten
- **Validierung** - Client-seitige Validierung mit Fehlermeldungen
- **Responsive Layouts** - Grid- und Spalten-Layouts
- **Modal-Dialog** - Konsistente UI für alle Formulare
- **Loading States** - Lade-Indikatoren beim Speichern

## Verwendung

```tsx
import FormEditor from '@/components/shared/Editors'

const hotelSections: FormSection[] = [
  {
    title: 'Grunddaten',
    gridCols: 2,
    fields: [
      {
        key: 'name',
        label: 'Hotelname',
        type: 'text',
        required: true,
        placeholder: 'z.B. Hilton Hotel'
      },
      {
        key: 'email',
        label: 'E-Mail',
        type: 'email',
        required: true,
        validation: (value) => {
          if (!value.includes('@')) return 'Ungültige E-Mail'
          return null
        }
      }
    ]
  },
  {
    title: 'Adresse',
    fields: [
      {
        key: 'street',
        label: 'Straße',
        type: 'text',
        required: true
      },
      {
        key: 'postalCode',
        label: 'PLZ',
        type: 'text',
        maxLength: 5,
        validation: (value) => {
          if (!/^\d{5}$/.test(value)) return 'PLZ muss 5 Ziffern haben'
          return null
        }
      }
    ]
  }
]

<FormEditor
  title="Hotel bearbeiten"
  sections={hotelSections}
  data={hotelData}
  onSave={handleSave}
  onCancel={handleCancel}
  isOpen={isModalOpen}
/>
```

## Feld-Typen

| Typ | Beschreibung | Beispiel |
|-----|-------------|---------|
| text | Einfaches Textfeld | `type: 'text'` |
| email | E-Mail Feld mit Validierung | `type: 'email'` |
| tel | Telefonnummer | `type: 'tel'` |
| date | Datumswähler | `type: 'date'` |
| select | Dropdown-Auswahl | `type: 'select'` |
| textarea | Mehrzeiliges Textfeld | `type: 'textarea'` |
| checkbox | Checkbox | `type: 'checkbox'` |
| number | Zahlenfeld | `type: 'number'` |

## FormField Props

| Prop | Typ | Beschreibung |
|------|-----|-------------|
| key | string | Eindeutiger Feld-Bezeichner |
| label | string | Angezeigter Label-Text |
| type | FieldType | Feld-Typ (siehe oben) |
| required | boolean | Pflichtfeld? |
| placeholder | string | Platzhalter-Text |
| options | Option[] | Optionen für Select-Felder |
| validation | Function | Eigene Validierungsfunktion |
| defaultValue | any | Standardwert |
| maxLength | number | Maximale Länge (Textfelder) |
| disabled | boolean | Feld deaktivieren? |

## FormSection Props

| Prop | Typ | Beschreibung |
|------|-----|-------------|
| title | string | Sektions-Titel |
| fields | FormField[] | Felder in dieser Sektion |
| gridCols | number | Spalten-Layout (1-4) |

## Beispiele

### Hotel Formular
```tsx
const hotelSections: FormSection[] = [
  {
    title: 'Hotel',
    gridCols: 2,
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'email', label: 'E-Mail', type: 'email', required: true },
      { key: 'phone', label: 'Telefon', type: 'tel' },
      { key: 'website', label: 'Website', type: 'text' }
    ]
  },
  {
    title: 'Adresse',
    gridCols: 2,
    fields: [
      { key: 'street', label: 'Straße', type: 'text', required: true },
      { key: 'postalCode', label: 'PLZ', type: 'text', maxLength: 5 },
      { key: 'city', label: 'Ort', type: 'text', required: true },
      { key: 'country', label: 'Land', type: 'select', 
        options: [{ value: 'de', label: 'Deutschland' }] }
    ]
  }
]
```

### Fahrzeug Formular
```tsx
const vehicleSections: FormSection[] = [
  {
    title: 'Fahrzeugdaten',
    gridCols: 2,
    fields: [
      { key: 'designation', label: 'Bezeichnung', type: 'text', required: true },
      { key: 'vehicleType', label: 'Typ', type: 'select', 
        options: [{ value: 'bus', label: 'Bus' }, { value: 'truck', label: 'LKW' }] },
      { key: 'licensePlate', label: 'Kennzeichen', type: 'text' },
      { key: 'driver', label: 'Fahrer', type: 'text' }
    ]
  }
]
```

### Profil Formular (komplex)
```tsx
const profileSections: FormSection[] = [
  {
    title: 'Persönliche Daten',
    gridCols: 2,
    fields: [
      { key: 'firstName', label: 'Vorname', type: 'text', required: true },
      { key: 'lastName', label: 'Nachname', type: 'text', required: true },
      { key: 'birthDate', label: 'Geburtstag', type: 'date' },
      { key: 'gender', label: 'Geschlecht', type: 'select',
        options: [{ value: 'male', label: 'Männlich' }, { value: 'female', label: 'Weiblich' }] }
    ]
  },
  {
    title: 'Ernährung',
    fields: [
      { key: 'diet', label: 'Ernährung', type: 'select',
        options: [{ value: 'all', label: 'Alles' }, { value: 'veg', label: 'Vegetarisch' }] },
      { key: 'glutenFree', label: 'Glutenfrei', type: 'checkbox' },
      { key: 'lactoseFree', label: 'Laktosefrei', type: 'checkbox' }
    ]
  }
]
```

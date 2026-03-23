# FileUpload Komponente

Eine universelle, wiederverwendbare Datei-Upload-Komponente für alle Module.

## Features

- **Drag & Drop** - Dateien per Drag-and-Drop hochladen
- **Multi-Upload** - Mehrere Dateien gleichzeitig
- **Datei-Management** - Umbenennen, Löschen, Herunterladen
- **Speicher-Info** - Visualisierung des Speicherplatzes
- **Vorschau** - Optional für Bilder/Dokumente
- **Validierung** - Dateigröße und Anzahl prüfen
- **Responsive** - Mobile-freundlich

## Verwendung

```tsx
import FileUpload from '@/components/shared/FileUpload'

<FileUpload
  title="Persönliche Dateien"
  category="personal"
  userId="fabianzimmermann"
  maxFiles={10}
  maxFileSizeMB={20}
  onUpload={handleUpload}
  onDelete={handleDelete}
  onDownload={handleDownload}
/>
```

## Props

| Prop | Typ | Default | Beschreibung |
|------|-----|---------|-------------|
| title | string | - | Angezeigter Titel |
| category | string | - | Datei-Kategorie (für Server-URL) |
| userId | string | - | Benutzer-ID (für Server-URL) |
| maxFiles | number | 10 | Maximale Dateianzahl |
| maxFileSizeMB | number | 50 | Maximale Dateigröße in MB |
| showEditButton | boolean | true | Upload-Button anzeigen |
| showStorageInfo | boolean | true | Speicher-Info anzeigen |
| showDownloadButton | boolean | true | Download-Button anzeigen |
| showPreviewButton | boolean | true | Vorschau-Button anzeigen |
| customFiles | FileItem[] | - | Eigene Dateiliste (statt Server) |
| onUpload | Function | - | Upload Handler |
| onDelete | Function | - | Löschen Handler |
| onRename | Function | - | Umbenennen Handler |
| onDownload | Function | - | Download Handler |
| onPreview | Function | - | Vorschau Handler |

## FileItem Interface

```tsx
interface FileItem {
  id: string
  name: string
  size: number
  type: string
  uploadDate: string
  url?: string
}
```

## Beispiele

### Persönliche Dateien
```tsx
<FileUpload
  title="Persönliche Dateien"
  category="personal"
  userId="fabianzimmermann"
  maxFiles={10}
  maxFileSizeMB={20}
  onUpload={async (files) => {
    const uploadedFiles = await uploadToServer(files, 'personal', 'fabianzimmermann')
    return uploadedFiles
  }}
  onDelete={async (fileId) => {
    await deleteFromServer(fileId)
  }}
/>
```

### Allgemeine Dateien
```tsx
<FileUpload
  title="Allgemeine Dateien"
  category="general"
  userId="fabianzimmermann"
  maxFiles={10}
  maxFileSizeMB={50}
  showPreviewButton={true}
  onPreview={(file) => {
    if (file.type.startsWith('image/')) {
      window.open(file.url, '_blank')
    }
  }}
/>
```

### Dokumente für Tour
```tsx
<FileUpload
  title="Tour-Dokumente"
  category="tour-docs"
  userId="fabianzimmermann"
  maxFiles={20}
  maxFileSizeMB={100}
  onDownload={async (file) => {
    // Custom download logic
    const blob = await fetch(file.url).then(r => r.blob())
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    link.click()
  }}
/>
```

## Server-Integration

Die Komponente ist so konzipiert, dass sie mit jedem Backend funktioniert:

```tsx
// Beispiel für Server-Integration
const handleUpload = async (files: FileList): Promise<FileItem[]> => {
  const formData = new FormData()
  Array.from(files).forEach(file => {
    formData.append('files', file)
  })
  
  const response = await fetch('/api/upload/personal/fabianzimmermann', {
    method: 'POST',
    body: formData
  })
  
  return await response.json()
}

const handleDelete = async (fileId: string) => {
  await fetch(`/api/files/${fileId}`, { method: 'DELETE' })
}
```

## Styling

Die Komponente verwendet Tailwind CSS und ist vollständig anpassbar:

- **className** - Container-Styling
- **height** - Höhe der Komponente
- **showStorageInfo** - Speicher-Info ein/aus
- **showEditButton** - Upload-Button ein/aus

## Datei-Icons

Die Komponente zeigt automatisch passende Icons basierend auf dem Dateityp:
- 🖼️ Bilder
- 🎥 Videos  
- 🎵 Audio
- 📄 PDFs
- 📝 Dokumente
- 📊 Tabellen
- 📈 Präsentationen
- 📦 Archive
- 📎 Standard

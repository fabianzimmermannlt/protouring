# Wiederverwendbare Komponenten

## 📋 UploadSection Komponente

### Beschreibung
Die `UploadSection` ist eine wiederverwendbare React-Komponente für Datei-Uploads mit voller Funktionalität.

### Verwendung
```tsx
import { UploadSection } from '@/components/UploadSection'

<UploadSection
  title="PERSÖNLICHE DATEIEN"
  category="personal"
  userId="fabianzimmermann"
  maxFiles={10}
  maxFileSizeMB={50}
  onFilesChange={(files) => setFiles(files)}
/>
```

---

## 📝 TextSection Komponente

### Beschreibung
Die `TextSection` ist eine wiederverwendbare React-Komponente für editierbare Textbereiche mit voller Funktionalität.

### Verwendung
```tsx
import { TextSection } from '@/components/TextSection'

<TextSection
  title="BÜHNE FREI"
  content={buhneFreiContent.content}
  onContentChange={(content) => setBuhneFreiContent(content)}
  editorTitle="Bühne Frei Text bearbeiten"
  storageKey="buhneFreiContent"
/>
```

---

## 💬 ChatSection Komponente

### Beschreibung
Die `ChatSection` ist eine wiederverwendbare React-Komponente für Chat-Funktionalität mit voller Chat-Experience.

### Verwendung
```tsx
import { ChatSection } from '@/components/ChatSection'

<ChatSection
  title="ALLGEMEINE KONVERSATION"
  storageKey="allgemeineKonversation"
  currentUserId="fabianzimmermann"
  currentUserName="Fabian Zimmermann"
  placeholder="Schreibe eine Nachricht..."
  maxMessages={100}
  isAdmin={true} // Nur Admins sehen Papierkorb-Icon
/>
```

### Props
| Prop | Typ | Beschreibung | Default |
|------|------|-------------|----------|
| `title` | `string` | Titel der Chat-Sektion | - |
| `storageKey` | `string` | localStorage Key für Persistenz | - |
| `currentUserId` | `string` | ID des aktuellen Benutzers | - |
| `currentUserName` | `string` | Name des aktuellen Benutzers | - |
| `showEditButton` | `boolean` | Edit-Button anzeigen | `true` |
| `className` | `string` | CSS-Klassen für Container | Standard-Layout |
| `height` | `string` | Höhe des Containers | `h-[400px]` |
| `placeholder` | `string` | Placeholder für Eingabefeld | "Schreibe eine Nachricht..." |
| `maxMessages` | `number` | Maximale Anzahl Nachrichten | `50` |
| `isAdmin` | `boolean` | Admin-Rechte für Lösch-Funktion | `false` |

### Features
- ✅ **Echte Chat-Experience** → Wie moderne Messaging-Apps
- ✅ **Auto-Scroll** → Scrollt automatisch zu neuen Nachrichten
- ✅ **Zeitstempel** → Datum und Uhrzeit jeder Nachricht
- ✅ **Autor-Anzeige** | Name des Verfassers
- ✅ **Persistenz** → Nachrichten bleiben nach Reload erhalten
- ✅ **Datenbegrenzung** | Max. Nachrichten verhindern Überlauf
- ✅ **Enter-Senden** | Enter zum Senden, Shift+Enter für Zeilenumbruch
- ✅ **Lösch-Funktion** | Papierkorb-Icon nur für Admins sichtbar
- ✅ **Responsive** | Mobile-Optimiert
- ✅ **Chat-Bubbles** | Blaue für eigene, graue für fremde Nachrichten

### Nachrichten-Format
```tsx
interface ChatMessage {
  id: string;
  author: string;        // "Fabian Zimmermann"
  message: string;       // "Hallo Team!"
  timestamp: Date;       // 2026-03-21T11:17:00.000Z
  userId?: string;       // "fabianzimmermann"
}
```

### Anzeige-Beispiel
```
┌─────────────────────────────────────────┐
│ Heute                                     │
├─────────────────────────────────────────┤
│                    Fabian Zimmermann      │
│ Hallo Team!                    11:15 │
├─────────────────────────────────────────┤
│                    Andere Person        │
│ Hi Fabian!                     11:16 │
└─────────────────────────────────────────┘
```

---

## 🎯 Anwendungsfälle

### Dashboard (4 Spalten)
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <TextSection title="BÜHNE FREI" content={buhneFreiContent} onContentChange={setBuhneFreiContent} />
  <UploadSection title="ALLGEMEINE DATEIEN" category="general" userId={userId} />
  <UploadSection title="PERSÖNLICHE DATEIEN" category="personal" userId={userId} />
  <ChatSection title="TEAM-CHAT" storageKey="teamChat" currentUserId={userId} currentUserName={userName} />
</div>
```

### Termin-Chat
```tsx
<ChatSection
  title="TERMIN-KOMMUNIKATION"
  storageKey="terminChat"
  currentUserId={userId}
  currentUserName={userName}
  placeholder="Nachricht zum Termin..."
  maxMessages={20}
/>
```

### Tour-Chat
```tsx
<ChatSection
  title="TOUR-KOMMUNIKATION"
  storageKey="tourChat"
  currentUserId={userId}
  currentUserName={userName}
  placeholder="Tour-Updates..."
  maxMessages={200}
/>
```

---

## 🔧 Vorteile der wiederverwendbaren Komponenten

### UploadSection
- ✅ **Wiederverwendbar** → Einmal implementieren, überall verwenden
- ✅ **Konsistent** → Gleiches Upload-Verhalten überall
- ✅ **Speicher-Ordnung** → `uploads/{category}/{userId}/`
- ✅ **Validierung** → Dateigröße und Anzahl prüfen
- ✅ **Drag & Drop** → Moderne Upload-Experience

### TextSection
- ✅ **Wiederverwendbar** → Für jeden Textbereich einsetzbar
- ✅ **Editierbar** → Integrierter FreeTextEditor
- ✅ **Flexibel** → Höhe, Titel, Edit-Button anpassbar
- ✅ **Konsistent** → Gleiches Aussehen überall
- ✅ **Auto-Save** → Inhalte werden automatisch gespeichert

### ChatSection
- ✅ **Wiederverwendbar** → Für jeden Chat-Bereich einsetzbar
- ✅ **Echte Chat-Experience** → Moderne Messaging-UI
- ✅ **Persistenz** → Nachrichten bleiben erhalten
- ✅ **Multi-User** → Unterstützt verschiedene Autoren
- ✅ **Flexibel** → Titel, Speicherort, Limits anpassbar

---

## 🚀 Beispiel: Komplette Seite mit wiederverwendbaren Komponenten

```tsx
// Import der Komponenten
import { UploadSection } from '@/components/UploadSection'
import { TextSection } from '@/components/TextSection'
import { ChatSection } from '@/components/ChatSection'

// Verwendung im Dashboard
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Spalte 1: Profil */}
  <ProfileSection profileData={profileData} onProfileChange={setProfileData} />
  {/* Spalte 2: Freier Text */}
  <TextSection
    title="BÜHNE FREI"
    content={buhneFreiContent}
    onContentChange={setBuhneFreiContent}
  />
  {/* Spalte 3: Allgemeine Dateien */}
  <UploadSection
    title="ALLGEMEINE DATEIEN"
    category="general"
    userId={userId}
  />
  {/* Spalte 4: Team-Chat */}
  <ChatSection
    title="TEAM-CHAT"
    storageKey="teamChat"
    currentUserId={userId}
    currentUserName={userName}
  />
</div>
```

---

## 📁 Speicher-Struktur

```
uploads/
├── personal/fabianzimmermann/     # PERSÖNLICHE DATEIEN
├── general/fabianzimmermann/      # ALLGEMEINE DATEIEN  
├── appointments/fabianzimmermann/ # TERMIN-DATEIEN
├── tour-docs/fabianzimmermann/    # Tour-Dokumente
└── templates/fabianzimmermann/     # Vorlagen

localStorage/
├── protouring_buhneFreiContent     # BÜHNE FREI Text
├── protouring_persoenlicheNotizen  # PERSÖNLICHE NOTIZEN
├── protouring_allgemeineKonversation # ALLGEMEINE KONVERSATION
├── protouring_teamChat             # TEAM-CHAT
└── protouring_terminChat           # TERMIN-CHAT
```

**Das System ist jetzt vollständig modular mit Chat-Funktionalität!** 🎉

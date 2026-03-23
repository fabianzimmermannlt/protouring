# Communication Komponente

## 🎯 Zweck
Wiederverwendbare Chat-Komponente für Echtzeitkommunikation mit lokaler Speicherung und Datenbank-Vorbereitung.

## 📋 Features
- **Chat-Interface** - Moderner Messenger-Style
- **Nachrichtentypen** - User, System, Admin
- **LocalStorage** - Automatische Speicherung
- **Datenbank-Ready** - Struktur für spätere DB-Integration
- **Responsive** - Mobile & Desktop optimiert
- **TypeScript** - Voll typisiert

## 🎨 Design
- **Header:** `bg-white border-b` mit Titel
- **Nachrichten:** Blaue User-Nachrichten, graue System/Admin
- **Input:** `bg-white border-t` mit Send-Button
- **Icons:** User, Bot, MessageCircle für Sendertypen

## 🔧 Verwendung

### Basic Usage
```tsx
import { Communication } from '@/app/components/shared/Communication'

<Communication 
  title="ALLGEMEINE KONVERSATION"
  storageKey="generalConversation"
/>
```

### Mit Callback für Datenbank
```tsx
<Communication 
  title="Team Chat"
  storageKey="teamChat"
  onSendMessage={async (message) => {
    // Speichern in Datenbank
    await saveMessageToDatabase(message)
  }}
/>
```

### Read-Only Modus
```tsx
<Communication 
  title="Archiv"
  enableInput={false}
  initialMessages={archivedMessages}
/>
```

## 📱 Nachrichtentypen

### User (blau)
```tsx
{
  id: "123",
  text: "Hallo Welt!",
  sender: "User",
  timestamp: new Date(),
  type: "user"
}
```

### System (grau)
```tsx
{
  id: "124", 
  text: "Systemmeldung",
  sender: "System",
  timestamp: new Date(),
  type: "system"
}
```

### Admin (grün)
```tsx
{
  id: "125",
  text: "Admin-Nachricht",
  sender: "Admin", 
  timestamp: new Date(),
  type: "admin"
}
```

## 🔗 Datenbank-Vorbereitung

### Message Interface
```tsx
interface Message {
  id: string          // UUID für DB
  text: string        // Nachrichtentext
  sender: string      // Sender-ID
  timestamp: Date     // Zeitstempel
  type: 'user' | 'system' | 'admin'
}
```

### DB-Speicherstruktur
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  text TEXT NOT NULL,
  sender VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  type VARCHAR(20) CHECK (type IN ('user', 'system', 'admin')),
  conversation_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 📝 Props
- `title?: string` - Titel (default: "Kommunikation")
- `placeholder?: string` - Input-Placeholder (default: "Nachricht eingeben...")
- `storageKey?: string` - LocalStorage Key
- `maxHeight?: string` - Maximale Höhe (default: "h-[400px]")
- `showHeader?: boolean` - Header anzeigen (default: true)
- `enableInput?: boolean` - Input aktivieren (default: true)
- `initialMessages?: Message[]` - Start-Nachrichten
- `onSendMessage?: (message: Message) => Promise<void>` - Callback für DB
- `className?: string` - Zusätzliche CSS-Klassen

## 🚀 Features

### Auto-Scroll
- Scrollt automatisch zur neuesten Nachricht
- Smooth-Animation für bessere UX

### Loading State
- Zeigt animierte Punkte während des Sendens
- Deaktiviert Input während Ladestatus

### Responsive Design
- Mobile: Vollbreite, kompakte Nachrichten
- Desktop: Max-Breite für bessere Lesbarkeit

### Zeitstempel
- Automatische Formatierung (HH:MM)
- Sender + Zeit unter jeder Nachricht

## 💡 Verwendungszwecke

### Team-Kommunikation
```tsx
<Communication 
  title="Team Chat"
  storageKey="teamChat"
  onSendMessage={saveToDatabase}
/>
```

### Kundensupport
```tsx
<Communication 
  title="Support"
  enableInput={false}
  initialMessages={supportHistory}
/>
```

### System-Benachrichtigungen
```tsx
<Communication 
  title="System-Meldungen"
  enableInput={false}
  initialMessages={systemMessages}
/>
```

## 🔧 Zukünftige Erweiterungen

### Geplante Features
- **Datenbank-Integration** - PostgreSQL/MySQL
- **Echtzeit-Updates** - WebSocket/SSE
- **File-Upload** - Bilder, Dokumente
- **Emojis** - Emoji-Picker
- **Suche** - Nachrichtensuche
- **Typing-Indikator** - "X schreibt..."

### Performance
- **Virtual Scrolling** - Bei vielen Nachrichten
- **Lazy Loading** - Ältere Nachrichten nachladen
- **Caching** - Offline-Unterstützung

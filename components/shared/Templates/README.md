# Design Templates Backup

## 🎨 Perfekte Design-Vorlagen

Diese Dateien sichern das perfekte Design, damit wir es jederzeit wiederherstellen können.

### ProfileEditor-ORIGINAL.tsx
- **Header:** `bg-gray-900 text-white px-6 py-4` mit `text-xl font-semibold`
- **Sektionen:** `text-sm font-semibold text-gray-900 border-b pb-2`
- **Labels:** `text-xs font-medium text-gray-700 mb-1`
- **Inputs:** `w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500`
- **Layout:** 2-Spalten Grid mit `gap-6`
- **Modal:** `bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh]`

### Navigation Komponente
- **Header:** `bg-gray-900 text-white` (wie ProfileEditor)
- **Aktiver Tab:** `bg-blue-600 text-white`
- **Inaktiver Tab:** `text-gray-300 hover:text-white hover:bg-gray-800`
- **Mobile:** Horizontales Scrollen bei kleinen Bildschirmen
- **Breite:** `max-w-full` (volle Bildschirmbreite)

### Wichtige Design-Regeln
- **Header-Farbe:** `bg-gray-900 text-white`
- **Schriftgrößen:** `text-xl` (Header), `text-sm` (Sektionen), `text-xs` (Labels)
- **Abstände:** `gap-6` (Grid), `space-y-3` (Felder), `space-y-6` (Sektionen)
- **Rahmen:** `border border-gray-300 rounded`
- **Focus:** `focus:ring-1 focus:ring-blue-500`

### Farben
- **Primary:** `blue-600` / `blue-500`
- **Text:** `gray-900` (dunkel), `gray-700` (mittel), `gray-500` (hell)
- **Background:** `white` (Haupt), `gray-50` (Sekundär), `gray-900` (Header)

### Verwendung
Wenn wir versehentlich das Design kaputt machen:
1. Kopiere die Styles aus `ProfileEditor-ORIGINAL.tsx`
2. Wende sie auf die neuen Komponenten an
3. Verwende die Navigation Komponente für konsistente Menüs
3. Behalte die exakten Klassen bei

**WICHTIG:** Diese Vorlage nicht ändern - sie ist die Referenz!

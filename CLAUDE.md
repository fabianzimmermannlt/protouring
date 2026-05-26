# ProTouring – CLAUDE.md

Kontext für Claude Code (Terminal). Parallel wird Cowork (Desktop-App) genutzt.
**Second Brain liegt im Obsidian-Vault, nicht im Projektordner**: `~/Hafen Studios Dropbox/Fabian Zimmermann/Obsidian/Vault/Vault/brain/`

---

## Projekt

Tour-Management Tool für Bands. Self-hosted, Single-Tenant.

- **Dev-Server starten**: `npm run dev` (Next.js, Port 3000) + `node server/index.js` (Express Backend, Port 3001)
- **Deployment**: `git push` → protouring.de (kein CI/CD, manuell)
- **DB**: SQLite (`protouring.db`), Migrations inline in `server/index.js`

---

## Tech-Stack

- **Frontend**: Next.js App Router, React, TypeScript, Tailwind CSS
- **Backend**: Express (`server/index.js`), SQLite via better-sqlite3
- **Auth**: Session-basiert, rollenbasiert via `getEffectiveRole()`

---

## Wichtige Dateien

```
app/
  globals.css                        ← Alle CSS-Klassen + Dark Mode overrides
  layout.tsx                         ← <html lang="de" className="dark"> – dark hardcoded!
  modules/
    termine/                         ← Events (Liste, Detail, Reisegruppe, Advancing, Travel)
    contacts/
    venues/
    partners/
    settings/
  components/shared/
    Navigation/L2Layout.tsx          ← Haupt-Layout
    Navigation/LayoutContext.tsx     ← useLayout() Hook (L1/L2/L3)
    SearchableDropdown.tsx
lib/
  api-client.ts                      ← Alle Types + API-Funktionen
server/
  index.js                           ← Backend + DB-Migrations
```

---

## Dark Mode – KRITISCH

`html.dark` ist in `app/layout.tsx` **hardcoded**. Kein Toggle. Gilt immer.

Dark Mode wird auf zwei Arten umgesetzt – beide existieren nebeneinander:

**1. CSS in globals.css** (für shared CSS-Klassen wie `modal-*`, `pt-card`, `form-input`):
```css
html.dark .modal-container { background: #2d2d2d; }
```

**2. Inline-Styles in React** (für komponentenspezifisches Styling):
```tsx
const { layout } = useLayout()
const dark = layout === 'L2'
// dann:
style={{ background: dark ? '#1e1e1e' : '#fff' }}
```

**Dark-Farb-Palette (pt-card Standard):**
| Element | Farbe |
|---------|-------|
| Card Body | `#1e1e1e` |
| Card Header | `#2d2d2d` |
| Modal (alle Bereiche) | `#2d2d2d` |
| Border | `#3c3c3c` |
| Text primary | `#e0e0e0` / `#e6edf3` |
| Text secondary | `#9ca3af` |
| Hover | `#2d2d2d` |
| Selected | `#1a3a5c` |

---

## CSS-Klassen-Konventionen

| Klasse | Bedeutung |
|--------|-----------|
| `pt-card` | Section-Kachel |
| `pt-card-header` | Kachel-Header mit Titel + Actions |
| `pt-card-body` | Kachel-Inhalt mit Padding |
| `modal-container` | Modal-Wrapper (max-w via Klasse) |
| `modal-header` | Modal-Kopfbereich |
| `modal-body` | Modal-Inhalt |
| `modal-footer` | Modal-Footer mit Buttons |
| `form-input` | Einheitliches Input-Styling |
| `form-label` | Label zu Inputs |
| `btn btn-primary` | Primary Button |
| `btn btn-ghost` | Ghost Button |
| `btn btn-danger` | Danger Button |
| `detail-input` | Underline-Style always-editable Input |
| `detail-label` | Label zu detail-input (10px, uppercase) |
| `pt-fn-chip` / `pt-fn-chip--active` | Toggle-Chips |

---

## Design-Patterns

### Always-editable Detail-Views
Alle Detail-Views zeigen Felder als editierbare Inputs (Underline-Style), kein Pencil-Toggle.
```ts
const originalRef = useRef(initialData)
const isDirty = JSON.stringify(form) !== JSON.stringify(originalRef.current)
useEffect(() => { (window as any).__pt_isDirty = isDirty }, [isDirty])
useEffect(() => { (window as any).__pt_save = saveEdit })
```

### Event-Bus (Custom Events)
Kommunikation zwischen Modulen:
- `termine-view-changed`, `termine-filter-changed`, `select-termin`, `termin-list-changed`, `termin-added`
- `termine-set-view` – Tab-Wechsel im Event-Detail

---

## Rollenmodell
```
admin > tourmanagement > agency > artist > crew_plus > crew > guest
```
Permissions via `canDo(role, CAN_*)` in `api-client.ts`.

---

## Git-Workflow

- Claude (Cowork + Code) committet, Fabian pusht manuell
- Commit-Messages auf Deutsch
- Kein Branch-Workflow aktuell, alles auf `main`

---

## Parallelbetrieb: Claude Code + Cowork

**Regel: Nie gleichzeitig dieselbe Datei bearbeiten.**

- Claude Code (Terminal): gut für größere Refactors, neue Features, Backend-Arbeit, TSC-Checks
- Cowork (Desktop): gut für UI-Feinschliff, schnelle Fixes, Brain-Updates

**Vor jeder Session den Stand prüfen:**
```bash
git log --oneline -10   # Was wurde zuletzt committed?
git status              # Gibt es uncommitted changes?
```

Wenn Cowork gerade arbeitet → `git stash` oder warten bis committed.
Brain-Files immer über Cowork aktualisieren (Obsidian-Vault-Pfad).

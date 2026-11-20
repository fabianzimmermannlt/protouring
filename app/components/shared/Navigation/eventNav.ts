// ============================================================
// Event-Sub-Navigation – gemeinsame Struktur (Phase 1)
// 8 Top-Reiter mit verschachtelten Sub-Navs.
// Views bleiben unverändert – nur Gruppierung/Erreichbarkeit.
// Genutzt von TermineSubNavigation (L3-Topbar) und
// TerminDetailHeader (L2-Tab-Bar).
// ============================================================

export interface EventNavLeaf {
  /** Content-View-ID, die beim Klick gesetzt wird */
  view: string
  label: string
  short?: string
  /** Permission-Suffix für can('event.'+permKey); default = view */
  permKey?: string
  /** Weitere selectedView-Werte, die dieses Blatt aktiv markieren */
  alias?: string[]
  editorOnly?: boolean
  needsBooking?: boolean
}

export interface EventNavGroup {
  id: string
  label: string
  short?: string
  /** Direkte View, falls keine children */
  view?: string
  permKey?: string
  alias?: string[]
  editorOnly?: boolean
  needsBooking?: boolean
  children?: EventNavLeaf[]
}

export const EVENT_NAV_GROUPS: EventNavGroup[] = [
  { id: 'details', label: 'Details', view: 'details2', permKey: 'details2', alias: ['details'] },
  { id: 'venue',   label: 'Venue',   view: 'venue' },
  { id: 'partner', label: 'Partner', view: 'partner', editorOnly: true },
  {
    id: 'show', label: 'Show', children: [
      { view: 'schedule',    label: 'Schedule' },
      { view: 'hospitality', label: 'Hospitality', alias: ['catering'] },
      { view: 'guestlist',   label: 'Gästeliste',  short: 'Gäste' },
      { view: 'setlist',     label: 'Setlist' },
    ],
  },
  {
    id: 'advancing', label: 'Advancing', children: [
      { view: 'advancing',     label: 'Advancing',     editorOnly: true },
      { view: 'briefing',      label: 'Briefing' },
      { view: 'files',         label: 'Dateien' },
      { view: 'advance-sheet', label: 'Advance Sheet', short: 'Advance', editorOnly: true },
    ],
  },
  { id: 'crew',    label: 'Crew',    short: 'Crew',    view: 'travelparty' },
  { id: 'travel',  label: 'Travel',  view: 'travel' },
  { id: 'booking', label: 'Booking', view: 'booking', editorOnly: true, needsBooking: true },
]

/** Prädikat: ist ein Blatt/eine Direkt-View sichtbar? */
export type CanLeaf = (leaf: { view: string; permKey?: string; editorOnly?: boolean; needsBooking?: boolean }) => boolean

/** Alle Blätter einer Gruppe (bei Direkt-View: die Gruppe selbst als ein Blatt) */
export function groupLeaves(g: EventNavGroup): EventNavLeaf[] {
  if (g.children && g.children.length) return g.children
  return [{ view: g.view || g.id, label: g.label, short: g.short, permKey: g.permKey, alias: g.alias, editorOnly: g.editorOnly, needsBooking: g.needsBooking }]
}

/** Sichtbare Blätter einer Gruppe */
export function visibleLeaves(g: EventNavGroup, canLeaf: CanLeaf): EventNavLeaf[] {
  return groupLeaves(g).filter(canLeaf)
}

/** Gruppen, die mindestens ein sichtbares Blatt haben */
export function visibleGroups(canLeaf: CanLeaf): EventNavGroup[] {
  return EVENT_NAV_GROUPS.filter(g => visibleLeaves(g, canLeaf).length > 0)
}

/** Default-View einer Gruppe = erstes sichtbares Blatt */
export function defaultViewForGroup(g: EventNavGroup, canLeaf: CanLeaf): string {
  const vis = visibleLeaves(g, canLeaf)
  return (vis[0] || groupLeaves(g)[0]).view
}

/** Alle View-Werte (inkl. alias), die zu einer Gruppe gehören */
function groupMatchViews(g: EventNavGroup): string[] {
  const out: string[] = []
  for (const l of groupLeaves(g)) {
    out.push(l.view)
    if (l.alias) out.push(...l.alias)
  }
  return out
}

/** Gruppe, die die aktive View enthält */
export function groupForView(view: string): EventNavGroup | undefined {
  const v = view || 'details2'
  return EVENT_NAV_GROUPS.find(g => groupMatchViews(g).includes(v))
    // 'details' zählt zur Details-Gruppe
    || (v === 'details' ? EVENT_NAV_GROUPS.find(g => g.id === 'details') : undefined)
}

/** Ist ein Blatt aktiv (inkl. alias-Normalisierung)? */
export function isLeafActive(leaf: EventNavLeaf, view: string): boolean {
  if (leaf.view === view) return true
  if (leaf.alias && leaf.alias.includes(view)) return true
  // 'details' ⇄ 'details2'
  if ((leaf.view === 'details2' && view === 'details') || (leaf.view === 'details' && view === 'details2')) return true
  return false
}

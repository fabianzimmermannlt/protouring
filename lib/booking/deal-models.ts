// Gemeinsame Liste der Deal-Modelle für die Baustein-Gruppierung (Reiter im
// Bausteine-Bereich) und die Auto-Zuordnung von Bausteinen zum Vertrag.
// IDs identisch mit den DEAL_MODELS in EventBookingView (deal_model des Vertrags).

export const DEAL_MODEL_TABS: { id: string; label: string }[] = [
  { id: 'fix', label: 'Fixgage' },
  { id: 'participation', label: 'Nur Beteiligung' },
  { id: 'vs', label: 'Fixgage gegen Beteiligung (vs)' },
  { id: 'plus', label: 'Fixgage plus Beteiligung' },
  { id: 'vs_break', label: 'vs ab Break-Even' },
]

/** deal_models (JSON-String oder Array) robust zu string[] parsen. Leer = „Allgemein". */
export function parseDealModels(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw === 'string' && raw.trim()) {
    try { const a = JSON.parse(raw); return Array.isArray(a) ? a.map(String) : [] } catch { return [] }
  }
  return []
}

export function dealModelLabel(id: string): string {
  return DEAL_MODEL_TABS.find(d => d.id === id)?.label ?? id
}

// Vorlagen = Vertragswelten (Agentur-Sets) über den Deal-Reitern. „fkp" ist die
// vorbefüllte FKP-Vorlage; „standard" ist eine offene Vorlage für eigene/andere Verträge.
// Leerer Wert zählt als „fkp" (Bestandsdaten), damit bestehende Verträge unverändert bleiben.
export const CLAUSE_TEMPLATES: { key: string; name: string }[] = [
  { key: 'fkp', name: 'FKP' },
  { key: 'standard', name: 'Standard' },
]

export function templateKey(x: unknown): string {
  const s = String(x ?? '').trim()
  return s || 'fkp'
}

export function templateName(key: string): string {
  return CLAUSE_TEMPLATES.find(t => t.key === key)?.name ?? key
}

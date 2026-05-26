# ProTouring – CLAUDE.md

## Session-Start (Pflicht)
Vor jeder Arbeit diese Dateien lesen:
1. `~/Hafen Studios Dropbox/Fabian Zimmermann/Obsidian/Vault/Vault/04 Projects/ProTouring/_INDEX.md`
2. `~/Hafen Studios Dropbox/Fabian Zimmermann/Obsidian/Vault/Vault/04 Projects/ProTouring/ARCHITECTURE.md`

Dann: `git log --oneline -10` + `git status` — um zu sehen was zuletzt committed wurde und ob es uncommitted changes gibt.

## Second Brain
Vollständiger Projektkontext:
`~/Hafen Studios Dropbox/Fabian Zimmermann/Obsidian/Vault/Vault/04 Projects/ProTouring/`

Brain-Updates nur über Cowork (Desktop App), nicht über Claude Code.

---

## Dev-Server starten
```bash
npm run dev          # Next.js Frontend (Port 3000)
node server/index.js # Express Backend (Port 3001)
```

Deployment: `git push` → protouring.de (Fabian pusht manuell, Claude committet nur)

---

## Parallelbetrieb: Claude Code + Cowork

Beide Tools arbeiten parallel auf demselben Repo.

**Vor jeder Session:**
```bash
git log --oneline -10   # Was wurde zuletzt committed?
git status              # Uncommitted changes?
```

Nie gleichzeitig dieselbe Datei bearbeiten. Brain-Updates immer über Cowork.

# ProTouring – CLAUDE.md

## Second Brain
Liegt im Obsidian-Vault – dort ist der vollständige Projektkontext:
`~/Hafen Studios Dropbox/Fabian Zimmermann/Obsidian/Vault/Vault/brain/`

Vor jeder Session lesen: `_INDEX.md` → Einstieg, aktueller Stand, letzte Commits.

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

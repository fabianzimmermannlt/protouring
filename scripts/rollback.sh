#!/bin/bash
# ============================================================
# ProTouring – Rollback-Skript
#
# Zwei Ebenen:
#   1. Code-Rollback:     letzten Git-Commit rückgängig machen
#   2. Datenbank-Rollback: auf einen Backup-Stand zurück
#
# Verwendung:
#   ./scripts/rollback.sh code          → letzten Commit rückgängig
#   ./scripts/rollback.sh db            → letztes DB-Backup einspielen
#   ./scripts/rollback.sh db 2024-01-15_02-00  → spezifischen Stand
#   ./scripts/rollback.sh full          → Code + DB gemeinsam zurück
# ============================================================

APP_DIR="/var/www/protouring"
BACKUP_DIR="/var/backups/protouring"
DB_FILE="$APP_DIR/protouring.db"

MODE="${1:-help}"
TARGET_TIMESTAMP="$2"

# ── Farben für Output ─────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ── Code-Rollback ─────────────────────────────────────────
rollback_code() {
  log_info "Code-Rollback gestartet..."
  cd "$APP_DIR"

  CURRENT=$(git log --oneline -1)
  PREVIOUS=$(git log --oneline -2 | tail -1)
  log_info "Aktueller Commit: $CURRENT"
  log_info "Zurück auf:       $PREVIOUS"

  read -p "Fortfahren? (j/N): " CONFIRM
  if [ "$CONFIRM" != "j" ] && [ "$CONFIRM" != "J" ]; then
    log_warn "Abgebrochen."
    exit 0
  fi

  git revert HEAD --no-edit
  npm run build
  pm2 restart ecosystem.config.js --update-env
  log_info "Code-Rollback abgeschlossen. App läuft wieder."
}

# ── DB-Rollback ───────────────────────────────────────────
rollback_db() {
  log_info "Verfügbare Datenbank-Backups:"
  echo ""
  ls -lt "$BACKUP_DIR/daily/"*.db 2>/dev/null | head -10 | awk '{print NR". " $NF}'
  echo ""

  if [ -n "$TARGET_TIMESTAMP" ]; then
    BACKUP_FILE="$BACKUP_DIR/daily/protouring_$TARGET_TIMESTAMP.db"
    if [ ! -f "$BACKUP_FILE" ]; then
      BACKUP_FILE="$BACKUP_DIR/weekly/protouring_$TARGET_TIMESTAMP.db"
    fi
    if [ ! -f "$BACKUP_FILE" ]; then
      log_error "Backup nicht gefunden: $TARGET_TIMESTAMP"
      exit 1
    fi
  else
    # Letztes Backup nehmen
    BACKUP_FILE=$(ls -t "$BACKUP_DIR/daily/"*.db 2>/dev/null | head -1)
    if [ -z "$BACKUP_FILE" ]; then
      log_error "Keine Backups gefunden in $BACKUP_DIR/daily/"
      exit 1
    fi
  fi

  log_warn "Backup wird eingespielt: $BACKUP_FILE"
  log_warn "Aktuelle Datenbank wird überschrieben!"
  read -p "Fortfahren? (j/N): " CONFIRM
  if [ "$CONFIRM" != "j" ] && [ "$CONFIRM" != "J" ]; then
    log_warn "Abgebrochen."
    exit 0
  fi

  # Aktuelle DB sichern bevor Rollback
  SAFETY_BACKUP="$BACKUP_DIR/daily/protouring_before-rollback_$(date +%Y-%m-%d_%H-%M).db"
  cp "$DB_FILE" "$SAFETY_BACKUP"
  log_info "Aktuelle DB gesichert als: $SAFETY_BACKUP"

  # App stoppen, DB austauschen, App starten
  pm2 stop all
  cp "$BACKUP_FILE" "$DB_FILE"
  pm2 start ecosystem.config.js
  log_info "DB-Rollback abgeschlossen."
}

# ── Dispatch ──────────────────────────────────────────────
case "$MODE" in
  code)
    rollback_code
    ;;
  db)
    rollback_db
    ;;
  full)
    log_info "Vollständiger Rollback: Code + Datenbank"
    rollback_code
    rollback_db
    ;;
  help|*)
    echo ""
    echo "Verwendung:"
    echo "  $0 code               → letzten Git-Commit rückgängig"
    echo "  $0 db                 → letztes DB-Backup einspielen"
    echo "  $0 db 2024-01-15_02-00 → spezifischen DB-Stand"
    echo "  $0 full               → Code + DB gemeinsam zurück"
    echo ""
    ;;
esac

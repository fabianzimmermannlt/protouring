#!/bin/bash
# ============================================================
# ProTouring – Backup-Skript
# Läuft täglich via Cron. Sichert Datenbank + Uploads.
#
# Backup-Strategie:
#   • 7 tägliche Backups  (rollierende Aufbewahrung)
#   • 4 wöchentliche Backups (jeden Sonntag)
#   • Backup-Verzeichnis: /var/backups/protouring/
#
# Cron einrichten (als root oder www-data):
#   crontab -e
#   0 2 * * * /var/www/protouring/scripts/backup.sh >> /var/log/protouring/backup.log 2>&1
# ============================================================

set -e

APP_DIR="/var/www/protouring"
BACKUP_DIR="/var/backups/protouring"
DB_FILE="$APP_DIR/protouring.db"
UPLOADS_DIR="$APP_DIR/uploads"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M)
DAY_OF_WEEK=$(date +%u)   # 1=Mo, 7=So

# Verzeichnisse anlegen
mkdir -p "$BACKUP_DIR/daily"
mkdir -p "$BACKUP_DIR/weekly"

echo "[$TIMESTAMP] Backup gestartet"

# ── Datenbank sichern ─────────────────────────────────────
if [ -f "$DB_FILE" ]; then
  # SQLite-sicheres Backup via .backup Befehl (keine Korruption bei laufender App)
  sqlite3 "$DB_FILE" ".backup '$BACKUP_DIR/daily/protouring_$TIMESTAMP.db'"
  echo "[$TIMESTAMP] DB gesichert: protouring_$TIMESTAMP.db"
else
  echo "[$TIMESTAMP] WARNUNG: Datenbank nicht gefunden: $DB_FILE"
fi

# ── Uploads sichern ──────────────────────────────────────
if [ -d "$UPLOADS_DIR" ]; then
  tar -czf "$BACKUP_DIR/daily/uploads_$TIMESTAMP.tar.gz" -C "$APP_DIR" uploads/
  echo "[$TIMESTAMP] Uploads gesichert: uploads_$TIMESTAMP.tar.gz"
fi

# ── Wöchentliches Backup (Sonntag) ────────────────────────
if [ "$DAY_OF_WEEK" -eq 7 ]; then
  cp "$BACKUP_DIR/daily/protouring_$TIMESTAMP.db" "$BACKUP_DIR/weekly/protouring_$TIMESTAMP.db"
  [ -f "$BACKUP_DIR/daily/uploads_$TIMESTAMP.tar.gz" ] && \
    cp "$BACKUP_DIR/daily/uploads_$TIMESTAMP.tar.gz" "$BACKUP_DIR/weekly/uploads_$TIMESTAMP.tar.gz"
  echo "[$TIMESTAMP] Wöchentliches Backup erstellt"
fi

# ── Alte Backups löschen (Aufräumen) ─────────────────────
# Täglich: älter als 7 Tage
find "$BACKUP_DIR/daily" -name "*.db" -mtime +7 -delete
find "$BACKUP_DIR/daily" -name "*.tar.gz" -mtime +7 -delete

# Wöchentlich: älter als 28 Tage (4 Wochen)
find "$BACKUP_DIR/weekly" -name "*.db" -mtime +28 -delete
find "$BACKUP_DIR/weekly" -name "*.tar.gz" -mtime +28 -delete

echo "[$TIMESTAMP] Alte Backups bereinigt"

# ── Übersicht ─────────────────────────────────────────────
echo "[$TIMESTAMP] Vorhandene Backups:"
ls -lh "$BACKUP_DIR/daily/"*.db 2>/dev/null | awk '{print "  daily: " $NF " (" $5 ")"}'
ls -lh "$BACKUP_DIR/weekly/"*.db 2>/dev/null | awk '{print "  weekly: " $NF " (" $5 ")"}'

echo "[$TIMESTAMP] Backup abgeschlossen"

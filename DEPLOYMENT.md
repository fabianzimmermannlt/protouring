# ProTouring – Deployment-Anleitung

Ziel: Lokale Entwicklung auf dem Mac, automatisches Deployment auf Hetzner bei jedem `git push`.

---

## Übersicht

```
Mac (Entwicklung)
    │
    │  git push origin main
    ▼
GitHub Repository
    │
    │  GitHub Actions (automatisch)
    ▼
Hetzner VPS
    ├── Next.js Frontend  (Port 3000)
    ├── Express API       (Port 3002)
    └── Nginx             (Port 80/443, leitet weiter)
```

---

## Phase 1 – GitHub Repository einrichten

### 1.1 Repository anlegen

1. Gehe zu [github.com/new](https://github.com/new)
2. Repository Name: `protouring`
3. Sichtbarkeit: **Private**
4. Kein README, keine .gitignore (haben wir schon)
5. Auf "Create repository" klicken

### 1.2 Lokales Repo mit GitHub verbinden

Im Terminal im Projektordner:

```bash
cd /pfad/zu/deinem/protouring-projekt

# GitHub als Remote hinzufügen (URL aus GitHub kopieren)
git remote add origin https://github.com/DEIN-USERNAME/protouring.git

# Ersten Push
git push -u origin main
```

Falls noch kein initialer Commit vorhanden:
```bash
git add .
git commit -m "feat: initial commit"
git push -u origin main
```

---

## Phase 2 – Hetzner Server buchen

### 2.1 Account & Server

1. Gehe zu [hetzner.com/cloud](https://www.hetzner.com/cloud) → Account anlegen oder einloggen
2. Neues Projekt anlegen: "ProTouring"
3. "Server hinzufügen" → Konfiguration:
   - **Standort:** Nürnberg oder Falkenstein (Deutschland)
   - **Image:** Ubuntu 22.04
   - **Typ:** CX22 (2 vCPU, 4 GB RAM, 40 GB SSD) ~4,85 €/Monat
   - **SSH-Key:** Neuen Key anlegen (siehe 2.2)
   - **Server-Name:** `protouring-prod`
4. Server erstellen → IP-Adresse notieren (z. B. `123.456.789.0`)

### 2.2 SSH-Key einrichten (einmalig auf dem Mac)

```bash
# SSH-Key generieren (falls noch keiner vorhanden)
ssh-keygen -t ed25519 -C "protouring-hetzner" -f ~/.ssh/protouring_hetzner

# Öffentlichen Key anzeigen (diesen in Hetzner einfügen)
cat ~/.ssh/protouring_hetzner.pub
```

Den angezeigten Key in Hetzner unter "SSH-Keys" einfügen.

### 2.3 SSH-Verbindung testen

```bash
ssh -i ~/.ssh/protouring_hetzner root@DEINE-IP
```

---

## Phase 3 – Server einrichten

Alle folgenden Befehle auf dem Hetzner-Server ausführen (nach SSH-Login).

### 3.1 System aktualisieren

```bash
apt update && apt upgrade -y
apt install -y git curl build-essential sqlite3 nginx certbot python3-certbot-nginx
```

### 3.2 Node.js installieren

```bash
# NVM (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# Node.js 20 LTS installieren
nvm install 20
nvm use 20
nvm alias default 20

# Prüfen
node -v   # sollte v20.x.x zeigen
npm -v
```

### 3.3 PM2 installieren

```bash
npm install -g pm2
```

### 3.4 Verzeichnisse anlegen

```bash
mkdir -p /var/www/protouring
mkdir -p /var/log/protouring
mkdir -p /var/backups/protouring/daily
mkdir -p /var/backups/protouring/weekly
```

### 3.5 Repository klonen

```bash
cd /var/www
git clone https://github.com/DEIN-USERNAME/protouring.git
cd protouring
```

### 3.6 Umgebungsvariablen einrichten

```bash
cp .env.example .env
nano .env
```

Folgende Werte eintragen:
```
JWT_SECRET=   ← langen Zufallsstring generieren (siehe unten)
PORT=3002
NEXT_PUBLIC_API_URL=https://DEINE-DOMAIN.de/api
FRONTEND_URL=https://DEINE-DOMAIN.de
```

JWT_SECRET generieren:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3.7 App bauen & starten

```bash
npm install
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # Befehl der ausgegeben wird kopieren und ausführen!
```

Prüfen ob alles läuft:
```bash
pm2 status
# Beide Prozesse sollten "online" sein
```

### 3.8 Nginx konfigurieren

```bash
nano /etc/nginx/sites-available/protouring
```

Inhalt (Domain anpassen):
```nginx
server {
    listen 80;
    server_name DEINE-DOMAIN.de;

    # Uploads (direkter Zugriff auf Dateien)
    location /uploads/ {
        alias /var/www/protouring/uploads/;
        expires 30d;
    }

    # API → Express (Port 3002)
    location /api/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Für File-Uploads: max. Größe
        client_max_body_size 50M;
    }

    # Alles andere → Next.js (Port 3000)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/protouring /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 3.9 SSL einrichten

```bash
certbot --nginx -d DEINE-DOMAIN.de
# Fragen beantworten, "Redirect HTTP to HTTPS" wählen
```

SSL erneuert sich automatisch. Prüfen:
```bash
certbot renew --dry-run
```

### 3.10 Backup-Cron einrichten

```bash
chmod +x /var/www/protouring/scripts/backup.sh

# Crontab öffnen
crontab -e
```

Zeile hinzufügen (täglich um 02:00 Uhr):
```
0 2 * * * /var/www/protouring/scripts/backup.sh >> /var/log/protouring/backup.log 2>&1
```

---

## Phase 4 – GitHub Actions konfigurieren

Damit GitHub automatisch auf den Server deployen kann, braucht es drei Secrets.

### 4.1 GitHub Secrets anlegen

Gehe in GitHub → Repository → Settings → Secrets and variables → Actions → "New repository secret"

Drei Secrets anlegen:

| Name | Wert |
|------|------|
| `HETZNER_HOST` | IP-Adresse des Servers (z. B. `123.456.789.0`) |
| `HETZNER_USER` | `root` |
| `HETZNER_SSH_KEY` | **Privaten** SSH-Key (Inhalt von `~/.ssh/protouring_hetzner`) |

Privaten Key anzeigen:
```bash
cat ~/.ssh/protouring_hetzner
```
Komplett kopieren (inkl. `-----BEGIN OPENSSH PRIVATE KEY-----` und `-----END...-----`).

### 4.2 Deployment testen

```bash
# Lokale Änderung machen, committen und pushen
git add .
git commit -m "test: deploy pipeline"
git push origin main
```

In GitHub → Repository → Actions: Deploy-Job beobachten.
Grüner Haken = erfolgreich deployed.

---

## Phase 5 – Lokale Entwicklung

### Täglicher Workflow

```bash
# Feature entwickeln
git add .
git commit -m "feat: neues Feature"
git push origin main
# → GitHub Actions deployed automatisch auf den Server
```

### Branches nutzen (empfohlen)

```bash
# Feature-Branch anlegen
git checkout -b feature/mein-feature

# ... Entwicklung ...

git push origin feature/mein-feature
# → GitHub Actions NICHT ausgelöst (nur main)

# Wenn fertig und getestet: in main mergen
git checkout main
git merge feature/mein-feature
git push origin main
# → jetzt wird deployed
```

---

## Rollback

### Code-Rollback (letzter Commit)

```bash
ssh root@DEINE-IP
cd /var/www/protouring
./scripts/rollback.sh code
```

### Datenbank-Rollback

```bash
ssh root@DEINE-IP

# Letztes Backup einspielen
./scripts/rollback.sh db

# Oder spezifischen Stand
./scripts/rollback.sh db 2024-01-15_02-00
```

### Vollständiger Rollback

```bash
./scripts/rollback.sh full
```

---

## Nützliche Befehle auf dem Server

```bash
# App-Status
pm2 status

# Logs live verfolgen
pm2 logs

# Nur Frontend-Logs
pm2 logs protouring-frontend

# Nur API-Logs
pm2 logs protouring-api

# App neu starten
pm2 restart ecosystem.config.js

# Backups anzeigen
ls -lh /var/backups/protouring/daily/

# Backup manuell auslösen
/var/www/protouring/scripts/backup.sh

# Nginx-Status
systemctl status nginx

# Certbot-Status
certbot certificates
```

---

## Domain ändern (wenn Testdomain → echte Domain)

1. DNS der neuen Domain auf die Hetzner-IP zeigen lassen (A-Record)
2. Auf dem Server:
```bash
nano /var/www/protouring/.env
# NEXT_PUBLIC_API_URL und FRONTEND_URL anpassen

nano /etc/nginx/sites-available/protouring
# server_name anpassen

certbot --nginx -d NEUE-DOMAIN.de

pm2 restart ecosystem.config.js
nginx -t && systemctl reload nginx
```

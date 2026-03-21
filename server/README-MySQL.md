# ProTouring MySQL Server Setup

## 🗄️ MySQL-basierte Multi-Tenant Lösung für Plesk

### **Vorteile mit MySQL:**
- ✅ **Plesk-kompatibel** - Standard auf den meisten Hostings
- ✅ **Einfache Verwaltung** über phpMyAdmin in Plesk
- ✅ **Robust und bewährt** für Web-Anwendungen
- ✅ **Gute Performance** für Multi-Tenant
- ✅ **Einfache Backups** über Plesk

---

## 📋 **Setup-Anleitung für deinen Plesk-Server**

### **1. MySQL-Datenbank in Plesk erstellen:**
1. **Plesk Login** → **Databases** → **Create Database**
2. **Datenbank-Name**: `protouring`
3. **Benutzer**: `protouring_user`
4. **Sicheres Passwort** generieren
5. **Zugriff von localhost erlauben**

### **2. Server-Dateien hochladen:**
```bash
# Alle Server-Dateien in ein Verzeichnis auf deinem Server kopieren
/var/www/vhosts/deine-domain.de/protouring-server/
```

### **3. Umgebungsvariablen konfigurieren:**
```bash
# .env Datei erstellen
cd /var/www/vhosts/deine-domain.de/protouring-server/
cp .env.example .env

# .env editieren
nano .env
```

```env
# Deine MySQL Zugangsdaten von Plesk
DB_HOST=localhost
DB_PORT=3306
DB_NAME=protouring
DB_USER=protouring_user
DB_PASSWORD=dein_sicheres_passwort

# JWT Secret (beliebiger langer String)
JWT_SECRET=dein_super_geheimes_jwt_secret_123456789
JWT_EXPIRES_IN=7d

# Server Port (wichtig für Plesk)
PORT=3002
NODE_ENV=production
```

### **4. Abhängigkeiten installieren:**
```bash
npm install
```

### **5. Datenbank initialisieren:**
```bash
npm run init-db
```
*Dieser Befehl erstellt alle Tabellen und einen Demo-Account*

### **6. Server starten:**
```bash
# Für Entwicklung
npm run dev

# Für Produktion
npm start
```

---

## 🔧 **Plesk-Konfiguration**

### **1. Node.js in Plesk aktivieren:**
- **Plesk** → **Tools & Settings** → **Updates** → **Add/Remove Components**
- **Node.js support** installieren

### **2. Subdomain erstellen:**
- **Domains** → **Create Subdomain**
- Name: `protouring` (oder beliebig)
- Document Root: `/protouring-server`

### **3. Nginx Reverse Proxy (empfohlen):**
In Plesk → **Apache & Nginx Settings** → **nginx directives**:

```nginx
location /api/ {
    proxy_pass http://localhost:3002;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

### **4. SSL-Zertifikat:**
- **Let's Encrypt** in Plesk aktivieren
- **HTTPS erzwingen** in den Domain-Einstellungen

---

## 🚀 **Deployment Schritte**

### **1. Frontend vorbereiten:**
```bash
# Im Hauptverzeichnis
npm run build
```

### **2. Frontend-Dateien kopieren:**
```bash
# Build-Output nach Server kopieren
cp -r .next /var/www/vhosts/deine-domain.de/protouring/
cp -r public /var/www/vhosts/deine-domain.de/protouring/
```

### **3. Node.js-Anwendung als Service:**
```bash
# systemd service erstellen
sudo nano /etc/systemd/system/protouring.service
```

```ini
[Unit]
Description=ProTouring Server
After=network.target

[Service]
Type=simple
User=dein-ftp-user
WorkingDirectory=/var/www/vhosts/deine-domain.de/protouring-server
ExecStart=/usr/bin/node server-mysql.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
# Service aktivieren und starten
sudo systemctl enable protouring
sudo systemctl start protouring
sudo systemctl status protouring
```

---

## 📊 **Datenbank-Struktur**

### **Artists Tabelle:**
```sql
CREATE TABLE artists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT true
);
```

### **Tour Data Tabelle:**
```sql
CREATE TABLE tour_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    artist_id INT NOT NULL,
    data_type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    content TEXT,
    metadata JSON,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_artist_data (artist_id, data_type)
);
```

---

## 🔐 **Security & Best Practices**

### **1. MySQL-Sicherheit:**
- ✅ **Separate Datenbank** für jede Anwendung
- ✅ **Eigener Benutzer** mit eingeschränkten Rechten
- ✅ **Starke Passwörter** verwenden
- ✅ **Regelmäßige Backups** über Plesk

### **2. Anwendungssicherheit:**
- ✅ **JWT Tokens** für Authentifizierung
- ✅ **Password Hashing** mit bcrypt
- ✅ **CORS** konfigurieren
- ✅ **HTTPS** erzwingen

### **3. Plesk-Sicherheit:**
- ✅ **Firewall** aktivieren
- ✅ **Fail2Ban** einrichten
- ✅ **Regelmäßige Updates** durchführen
- ✅ **Backup-Strategie** konfigurieren

---

## 🎯 **Multi-Tenant Funktionsweise**

### **Jeder Artist hat:**
- **Eigene Login-Daten**
- **Getrennte Daten** in der Datenbank
- **Eigene Tour-Daten**
- **Unabhängiger Zugriff**

### **Daten-Isolation:**
```sql
-- Artist 1 Daten
SELECT * FROM tour_data WHERE artist_id = 1;

-- Artist 2 Daten  
SELECT * FROM tour_data WHERE artist_id = 2;

-- Keine Cross-Access möglich!
```

---

## 📱 **Frontend Konfiguration**

### **API-URL anpassen:**
```javascript
// lib/api.js
const API_BASE_URL = 'https://protouring.deine-domain.de/api';
```

### **Umgebungsvariable:**
```bash
# .env.local im Frontend
NEXT_PUBLIC_API_URL=https://protouring.deine-domain.de
```

---

## 🧪 **Testen**

### **Demo-Account:**
- **Username**: `demo`
- **Passwort**: `demo123`

### **API-Test:**
```bash
curl -X POST https://protouring.deine-domain.de/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo123"}'
```

---

## 🔄 **Wartung & Updates**

### **1. Backups:**
- **Automatische Backups** über Plesk einrichten
- **Datenbank-Export** vor Updates

### **2. Updates:**
```bash
# Server aktualisieren
cd /var/www/vhosts/deine-domain.de/protouring-server/
git pull
npm install
npm run build
sudo systemctl restart protouring
```

### **3. Monitoring:**
- **Logs überprüfen**: `sudo journalctl -u protouring -f`
- **Datenbank-Performance** über phpMyAdmin
- **Server-Load** über Plesk

---

## 🆘 **Troubleshooting**

### **Häufige Probleme:**

#### **1. Datenbank-Verbindung fehlgeschlagen:**
```bash
# .env überprüfen
cat .env | grep DB_

# MySQL-Status prüfen
sudo systemctl status mysql
```

#### **2. Port bereits belegt:**
```bash
# Port prüfen
sudo netstat -tulpn | grep :3002

# Port ändern in .env
PORT=3003
```

#### **3. Berechtigungsprobleme:**
```bash
# Dateiberechtigungen setzen
sudo chown -R dein-ftp-user:psacln /var/www/vhosts/deine-domain.de/protouring-server/
```

---

## 📞 **Support**

Bei Problemen:
1. **Logs überprüfen**: `sudo journalctl -u protouring`
2. **Datenbank-Verbindung** testen
3. **Firewall-Einstellungen** prüfen
4. **Plesk-Logs** ansehen

---

**Fertig! Deine ProTouring Multi-Tenant Plattform läuft auf deinem Plesk-Server mit MySQL!** 🎉

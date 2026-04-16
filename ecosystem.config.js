// PM2 Ecosystem – ProTouring
// Startet Next.js Frontend + Express API gleichzeitig
// Verwendung:
//   pm2 start ecosystem.config.js        (starten)
//   pm2 restart ecosystem.config.js      (neu starten)
//   pm2 stop ecosystem.config.js         (stoppen)
//   pm2 logs                              (Logs anzeigen)

module.exports = {
  apps: [
    {
      name: 'protouring-frontend',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: '/var/www/protouring',
      env: {
        NODE_ENV: 'production',
      },
      // Automatisch neu starten bei Absturz
      autorestart: true,
      // Max. Speicher bevor PM2 neu startet (CX22 hat 4GB)
      max_memory_restart: '512M',
      // Logs
      out_file: '/var/log/protouring/frontend-out.log',
      error_file: '/var/log/protouring/frontend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'protouring-api',
      script: 'server/index.js',
      cwd: '/var/www/protouring',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
      autorestart: true,
      max_memory_restart: '256M',
      out_file: '/var/log/protouring/api-out.log',
      error_file: '/var/log/protouring/api-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};

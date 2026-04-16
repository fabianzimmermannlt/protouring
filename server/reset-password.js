/**
 * Passwort-Reset Script
 * Aufruf: node reset-password.js <email> <neues-passwort>
 * Beispiel: node reset-password.js fabian@blindpage.de MeinNeuesPasswort123
 */

const bcrypt = require('bcryptjs');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');

const [,, email, newPassword] = process.argv;

if (!email || !newPassword) {
  console.error('Aufruf: node reset-password.js <email> <neues-passwort>');
  process.exit(1);
}

(async () => {
  const db = await open({
    filename: path.join(__dirname, 'protouring.db'),
    driver: sqlite3.Database,
  });

  const user = await db.get('SELECT id, email FROM users WHERE email = ?', [email]);
  if (!user) {
    console.error(`Kein User mit E-Mail "${email}" gefunden.`);
    process.exit(1);
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
  console.log(`✅ Passwort für ${email} erfolgreich zurückgesetzt.`);
  await db.close();
})();

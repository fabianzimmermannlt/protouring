/**
 * Einmalig ausführen: node scripts/seed-fabian.js
 * Legt Fabians Account + Tenant "Fabian Zimmermann" in der DB an.
 */

const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');

const PASSWORD = 'ProTouring2026!';

async function seed() {
  const db = await open({
    filename: path.join(__dirname, '../protouring.db'),
    driver: sqlite3.Database
  });

  await db.run('PRAGMA foreign_keys = ON');

  console.log('🌱 Starte Seed...\n');

  // Prüfen ob User schon existiert
  const existing = await db.get('SELECT id FROM users WHERE email = ?', ['fabian@blindpage.de']);
  if (existing) {
    console.log('ℹ️  User fabian@blindpage.de existiert bereits (id:', existing.id, ')');
    console.log('   Passwort zurücksetzen auf:', PASSWORD);
    const hash = await bcrypt.hash(PASSWORD, 10);
    await db.run('UPDATE users SET password_hash = ? WHERE email = ?', [hash, 'fabian@blindpage.de']);
    console.log('✅ Passwort aktualisiert.');
    await db.close();
    return;
  }

  await db.run('BEGIN TRANSACTION');
  try {
    const hash = await bcrypt.hash(PASSWORD, 10);

    // User anlegen
    const userResult = await db.run(
      'INSERT INTO users (email, password_hash, first_name, last_name, phone) VALUES (?, ?, ?, ?, ?)',
      ['fabian@blindpage.de', hash, 'Fabian', 'Zimmermann', '+49 1749181911']
    );
    const userId = userResult.lastID;
    console.log('✅ User angelegt (id:', userId, ')');

    // Tenant anlegen
    const tenantResult = await db.run(
      `INSERT INTO tenants (name, slug, email, status, trial_ends_at)
       VALUES (?, ?, ?, 'trial', datetime('now', '+14 days'))`,
      ['Betontod', 'betontod', 'fabian@blindpage.de']
    );
    const tenantId = tenantResult.lastID;
    console.log('✅ Tenant angelegt (id:', tenantId, ', slug: betontod)');

    // Subscription anlegen (Plan 1 = Starter)
    await db.run(
      `INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
       VALUES (?, 1, 'trial', datetime('now'), datetime('now', '+14 days'))`,
      [tenantId]
    );
    console.log('✅ Trial-Subscription angelegt');

    // User als Owner verknüpfen
    await db.run(
      `INSERT INTO user_tenants (user_id, tenant_id, role, status, joined_at)
       VALUES (?, ?, 'owner', 'active', datetime('now'))`,
      [userId, tenantId]
    );
    console.log('✅ User als Owner verknüpft');

    await db.run('COMMIT');

    console.log('\n================================================');
    console.log('🎸 Account erfolgreich angelegt!');
    console.log('');
    console.log('   E-Mail    : fabian@blindpage.de');
    console.log('   Passwort  : ' + PASSWORD);
    console.log('   Tenant    : betontod');
    console.log('================================================\n');

  } catch (err) {
    await db.run('ROLLBACK');
    console.error('❌ Fehler:', err.message);
  }

  await db.close();
}

seed().catch(console.error);

// Starts the store: opens the database, seeds the demo catalog on first run, serves the API + website.
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { openDb } from './db.js';
import { createStorage } from './storage.js';
import { createApp } from './app.js';
import { requestContext } from './context.js';
import { createPersistence, createTurso } from './remote.js';
import { migrate } from '../core/schema.js';
import { seedDemo } from '../core/seed/index.js';
import { AUTH, hashPassword, passwordProblem } from '../core/auth.js';
import { isoNow } from '../core/util.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = process.env;
const prod = env.NODE_ENV === 'production';
const dataDir = resolve(env.DATA_DIR || join(root, 'data'));
const dbFile = join(dataDir, 'store.db');
const port = Number(env.PORT) || 3000;

// ---------------------------------------------------------------- optional backup service (free hosting)
let persistence = null;
if (env.TURSO_DATABASE_URL) {
  if (!env.TURSO_AUTH_TOKEN) {
    console.error('TURSO_AUTH_TOKEN is missing (create a token for the database on turso.tech).');
    process.exit(1);
  }
  const { mkdirSync } = await import('node:fs');
  mkdirSync(dataDir, { recursive: true });
  // (BACKUP_*_MS only exist to speed up the automated tests.)
  persistence = createPersistence({
    turso: createTurso({ url: env.TURSO_DATABASE_URL, token: env.TURSO_AUTH_TOKEN }),
    dbFile,
    ...(env.BACKUP_SOON_MS && { soon: Number(env.BACKUP_SOON_MS) }),
  });
  // The saved data must be loaded before the shop opens. If Turso cannot be reached, stop instead of starting
  // empty (an empty shop would later overwrite the real data). The host restarts the server and it tries again.
  let latest = null;
  for (let attempt = 1; ; attempt++) {
    try {
      latest = await persistence.restore();
      break;
    } catch (e) {
      console.error(`[backup] ${e.message}`);
      if (e.auth || attempt >= 5) {
        console.error('Could not load the saved data from Turso. Check TURSO_DATABASE_URL and TURSO_AUTH_TOKEN. Stopping so nothing is overwritten.');
        process.exit(1);
      }
      await sleep(attempt * (Number(env.BACKUP_RETRY_MS) || 3000));
    }
  }
  console.log(latest ? `[backup] Loaded the data saved on ${latest.at}.` : '[backup] Connected to Turso. Nothing saved yet: starting a new shop.');
}

let tracking = false; // writes made while setting up the schema are not worth a backup
const db = openDb(dbFile, { onWrite: () => tracking && persistence?.markDirty(requestContext.getStore()?.important ?? true) });
persistence?.attach(db);
migrate(db);
tracking = true;
const storage = createStorage(join(dataDir, 'uploads'), { remote: persistence });

if (env.SEED_DEMO !== 'false') {
  const seeded = seedDemo(db, { saveSvg: (name, svg) => storage.saveSeedSvg(name, svg), extras: env.SEED_DEMO_EXTRAS === 'true' });
  if (seeded) console.log('Demo catalog created (remove it any time from Admin → Settings → Backup & demo data).');
}

// Optional: create the owner account from environment variables (useful on hosting platforms).
// With ADMIN_RESET_PASSWORD=true the password of that account is set again (for a forgotten password).
if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
  const email = env.ADMIN_EMAIL.trim().toLowerCase();
  const existing = db.get('SELECT id FROM admins WHERE email = ?', email);
  if (passwordProblem(env.ADMIN_PASSWORD)) {
    console.error('ADMIN_PASSWORD must be at least 8 characters: the admin account was not changed.');
  } else if (!existing) {
    db.run("INSERT INTO admins (name, email, password_hash, role, created_at) VALUES (?, ?, ?, 'owner', ?)", env.ADMIN_NAME || 'Owner', email, await hashPassword(env.ADMIN_PASSWORD, AUTH.iterations), isoNow());
    console.log(`Admin account created for ${email}`);
  } else if (env.ADMIN_RESET_PASSWORD === 'true') {
    db.run('UPDATE admins SET password_hash = ? WHERE id = ?', await hashPassword(env.ADMIN_PASSWORD, AUTH.iterations), existing.id);
    db.run("DELETE FROM sessions WHERE kind = 'admin' AND user_id = ?", existing.id);
    console.log(`Password reset for ${email}. Remove ADMIN_RESET_PASSWORD now.`);
  }
}

if (persistence) {
  try {
    await persistence.flushNow();
  } catch (e) {
    console.error(`[backup] ${e.message}`);
  }
  // During an update the previous server may save its last orders after this one started: pick them up.
  persistence.catchUp((bytes) => db.reload(bytes), { every: Number(env.BACKUP_CATCHUP_MS) || 10000 });
}

const { app } = createApp({
  db,
  storage,
  distDir: join(root, 'dist'),
  prod,
  publicUrl: (env.PUBLIC_URL || '').replace(/\/$/, ''),
  remote: persistence,
});

const server = app.listen(port, () => {
  const needsSetup = db.get('SELECT COUNT(*) AS n FROM admins').n === 0;
  console.log(`Smart Phone Store is running on http://localhost:${port}`);
  if (needsSetup) console.log(`Open http://localhost:${port}/admin to create the owner account.`);
});

let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  setTimeout(() => process.exit(0), 25000).unref();
  server.close();
  if (persistence) {
    try {
      await persistence.flushNow(); // last changes go to the backup before the host stops this server
    } catch (e) {
      console.error(`[backup] ${e.message}`);
    }
  }
  db.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

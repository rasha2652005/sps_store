// Free-hosting backups (server/remote.js) against a stand-in for Turso: the shop survives losing its disk,
// never starts empty when the backup can't be reached, and keeps orders taken during an update.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMockTurso } from './helpers/mock-turso.js';
import { createPersistence, createTurso } from '../server/remote.js';
import { openDb } from '../server/db.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const dirs = [];
const tempDir = () => {
  const d = mkdtempSync(join(tmpdir(), 'sps-backup-test-'));
  dirs.push(d);
  return d;
};

let turso;
let nextPort = 4600 + Math.floor(Math.random() * 300);

function startServer({ dir, env = {} }) {
  const port = nextPort++;
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: dir,
      TURSO_DATABASE_URL: turso.url,
      TURSO_AUTH_TOKEN: turso.token,
      SEED_DEMO: 'true',
      SEED_DEMO_EXTRAS: 'false',
      ADMIN_EMAIL: 'owner@test.com',
      ADMIN_PASSWORD: 'longpassword1',
      BACKUP_SOON_MS: '150',
      BACKUP_CATCHUP_MS: '200',
      BACKUP_RETRY_MS: '20',
      NODE_ENV: 'test',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));
  const exited = new Promise((r) => child.on('exit', (code) => r(code)));
  const ready = new Promise((resolve, reject) => {
    const t = setInterval(() => {
      if (output.includes('is running on')) {
        clearInterval(t);
        resolve();
      }
    }, 25);
    exited.then((code) => {
      clearInterval(t);
      reject(new Error(`server exited (${code}):\n${output}`));
    });
  });
  const base = `http://127.0.0.1:${port}`;
  const jar = {};
  const call = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-SPS': '1', Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const [k, v] = kv.split('=');
      if (v) jar[k] = v;
      else delete jar[k];
    }
    const type = res.headers.get('content-type') || '';
    return { status: res.status, body: type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
  };
  return {
    ready,
    exited,
    get output() {
      return output;
    },
    get: (p) => call('GET', p),
    post: (p, b) => call('POST', p, b),
    stop: async () => {
      child.kill('SIGTERM');
      return exited;
    },
    kill: () => child.kill('SIGKILL'),
  };
}

const order = async (s, slug) => {
  const p = await s.get(`/api/products/${slug}`);
  assert.equal(p.status, 200);
  const v = p.body.product.variants.find((x) => x.stock > 0);
  const r = await s.post('/api/orders', {
    items: [{ variant_id: v.id, qty: 1 }],
    customer: { name: 'Backup Test', phone: '71 234 567' },
    delivery: { method: 'delivery', zone: 'beirut', city: 'Hamra', street: 'Bliss' },
    payment_method: 'cod',
    lang: 'en',
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.order;
};

before(async () => {
  turso = await startMockTurso({ token: 'secret-token' });
});
after(async () => {
  await turso.close();
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

let first; // { order, photo }

test('a fresh shop is saved to the backup and comes back after losing its disk', async () => {
  const dir = tempDir();
  const a = startServer({ dir });
  await a.ready;
  assert.match(a.output, /Nothing saved yet/);
  const o = await order(a, 'gan-65w-3-port-charger');
  const login = await a.post('/api/admin/login', { email: 'owner@test.com', password: 'longpassword1' });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  const up = await a.post('/api/admin/uploads', { data_url: `data:image/png;base64,${PNG}`, thumb_data_url: `data:image/png;base64,${PNG}` });
  assert.equal(up.status, 200, JSON.stringify(up.body));
  first = { order: o, photo: up.body.url };
  assert.equal(await a.stop(), 0);
  rmSync(dir, { recursive: true, force: true }); // the host wiped the disk

  const b = startServer({ dir: tempDir() });
  await b.ready;
  assert.match(b.output, /Loaded the data saved on/);
  const view = await b.get(`/api/orders/${o.number}?key=${o.key}`);
  assert.equal(view.status, 200);
  assert.equal(view.body.order.customer.name, 'Backup Test');
  const photo = await b.get(first.photo);
  assert.equal(photo.status, 200);
  assert.deepEqual(photo.body, Buffer.from(PNG, 'base64'));
  const thumb = await b.get(first.photo.replace(/\.png$/, '.t.png'));
  assert.equal(thumb.status, 200);
  const seedImage = (await b.get('/api/products/gan-65w-3-port-charger')).body.product.images[0].url;
  assert.equal((await b.get(seedImage)).status, 200, 'demo pictures are restored too');
  // the demo catalog was not created a second time
  const list = await b.get('/api/products?limit=100');
  assert.equal(new Set(list.body.items.map((x) => x.slug)).size, list.body.items.length);
  assert.equal(await b.stop(), 0);
});

test('a wrong token stops the server instead of starting an empty shop', async () => {
  const s = startServer({ dir: tempDir(), env: { TURSO_AUTH_TOKEN: 'wrong' } });
  await assert.rejects(s.ready, /exited \(1\)/);
  assert.match(s.output, /Check TURSO_DATABASE_URL and TURSO_AUTH_TOKEN/);
});

test('when the backup is unreachable the server stops and nothing is overwritten', async () => {
  const before = turso.db.prepare("SELECT value FROM sps_meta WHERE key = 'latest'").get().value;
  turso.state.down = true;
  const s = startServer({ dir: tempDir() });
  await assert.rejects(s.ready, /exited \(1\)/);
  turso.state.down = false;
  assert.equal(turso.db.prepare("SELECT value FROM sps_meta WHERE key = 'latest'").get().value, before);
});

test('orders taken by the old server during an update reach the new one', async () => {
  const old = startServer({ dir: tempDir() });
  await old.ready;
  const fresh = startServer({ dir: tempDir() });
  await fresh.ready; // the new server starts while the old one still answers customers
  const late = await order(old, 'airpods-pro-3');
  assert.equal(await old.stop(), 0); // the host stops the old server: it saves its last changes
  let seen = 0;
  for (let i = 0; i < 40 && seen !== 200; i++) {
    await new Promise((r) => setTimeout(r, 150));
    seen = (await fresh.get(`/api/orders/${late.number}?key=${late.key}`)).status;
  }
  assert.equal(seen, 200, `new server did not pick up the order:\n${fresh.output}`);
  assert.match(fresh.output, /Picked up the last changes/);
  // and the order from the first test is still there
  assert.equal((await fresh.get(`/api/orders/${first.order.number}?key=${first.order.key}`)).status, 200);
  assert.equal(await fresh.stop(), 0);
});

test('an old server cannot overwrite newer saves', async () => {
  const t = createTurso({ url: turso.url, token: turso.token });
  const dirA = tempDir();
  const dirB = tempDir();
  const mk = (dir) => {
    const p = createPersistence({ turso: t, dbFile: join(dir, 'store.db'), log: () => {}, soon: 10 });
    return p;
  };
  const pa = mk(dirA);
  await pa.restore();
  const dbA = openDb(join(dirA, 'store.db'));
  pa.attach(dbA);
  const pb = mk(dirB);
  await pb.restore();
  const dbB = openDb(join(dirB, 'store.db'));
  pb.attach(dbB);
  dbB.exec("INSERT INTO meta (key, value) VALUES ('who', 'B') ON CONFLICT(key) DO UPDATE SET value = 'B'");
  pb.markDirty(true);
  await pb.flushNow(); // the new server saves first
  dbA.exec("INSERT INTO meta (key, value) VALUES ('who', 'A') ON CONFLICT(key) DO UPDATE SET value = 'A'");
  pa.markDirty(true);
  await pa.flushNow();
  assert.equal(pa.lostOwnership, true);
  const latest = JSON.parse(turso.db.prepare("SELECT value FROM sps_meta WHERE key = 'latest'").get().value);
  assert.equal(latest.instance, pb.instanceId);
  dbA.close();
  dbB.close();
});

test('the owner password can be reset from the environment', async () => {
  const s = startServer({ dir: tempDir(), env: { ADMIN_PASSWORD: 'brandnewpass9', ADMIN_RESET_PASSWORD: 'true' } });
  await s.ready;
  assert.match(s.output, /Password reset for owner@test.com/);
  assert.notEqual((await s.post('/api/admin/login', { email: 'owner@test.com', password: 'longpassword1' })).status, 200);
  assert.equal((await s.post('/api/admin/login', { email: 'owner@test.com', password: 'brandnewpass9' })).status, 200);
  assert.equal(await s.stop(), 0);
});

test('a large database is saved in several parts and restored intact', async () => {
  const t = createTurso({ url: turso.url, token: turso.token });
  const dir = tempDir();
  const p = createPersistence({ turso: t, dbFile: join(dir, 'store.db'), log: () => {}, soon: 10 });
  await p.restore();
  const db = openDb(join(dir, 'store.db'));
  p.attach(db);
  db.exec('CREATE TABLE IF NOT EXISTS big (data BLOB)');
  const blob = randomBytes(1200 * 1024); // does not compress
  db.run('INSERT INTO big (data) VALUES (?)', blob);
  p.markDirty(true);
  await p.flushNow();
  const latest = JSON.parse(turso.db.prepare("SELECT value FROM sps_meta WHERE key = 'latest'").get().value);
  assert.ok(latest.parts >= 3, `parts: ${latest.parts}`);
  const dir2 = tempDir();
  const p2 = createPersistence({ turso: t, dbFile: join(dir2, 'store.db'), log: () => {} });
  await p2.restore();
  const db2 = openDb(join(dir2, 'store.db'));
  assert.ok(Buffer.from(db2.get('SELECT data FROM big').data).equals(blob));
  const kept = turso.db.prepare('SELECT COUNT(DISTINCT snap) AS n FROM sps_parts').get().n;
  assert.ok(kept <= 3, `old copies are cleaned up (${kept} kept)`);
  db.close();
  db2.close();
});

// Keeps the store's data safe on hosts without a permanent disk (for example Render's free plan).
// The database lives in a local SQLite file as usual; a compressed copy of it, and every uploaded photo, is also
// saved to a free Turso database (turso.tech). On start-up the latest copy is downloaded before the shop opens.
//
// Turso is reached over its HTTP API (Hrana v2 "pipeline"), so no extra packages are needed.
import { gzipSync, gunzipSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PART_SIZE = 384 * 1024; // the copy is stored in chunks of this size (one per request)
const KEEP_COPIES = 3; // older copies are deleted
const SOON = 3000; // after an order or an admin change, save within 3 s
const LATER = 10 * 60 * 1000; // small background changes (search stats, sessions) are saved every 10 min
const RETRY = 30 * 1000;

// ---------------------------------------------------------------- Turso HTTP client
function toValue(v) {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'number') return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v };
  if (typeof v === 'bigint') return { type: 'integer', value: v.toString() };
  if (typeof v === 'boolean') return { type: 'integer', value: v ? '1' : '0' };
  if (typeof v === 'string') return { type: 'text', value: v };
  if (v instanceof Uint8Array) return { type: 'blob', base64: Buffer.from(v).toString('base64') };
  throw new TypeError(`Unsupported value for Turso: ${typeof v}`);
}

function fromValue(v) {
  switch (v?.type) {
    case 'integer':
    case 'float':
      return Number(v.value);
    case 'text':
      return v.value;
    case 'blob':
      return Buffer.from(v.base64 || '', 'base64');
    default:
      return null;
  }
}

export class RemoteError extends Error {
  constructor(message, { status = 0, auth = false } = {}) {
    super(message);
    this.status = status;
    this.auth = auth;
  }
}

export function createTurso({ url, token, fetchImpl = globalThis.fetch, timeoutMs = 25000 }) {
  const base = String(url || '')
    .trim()
    .replace(/^libsql:\/\//i, 'https://')
    .replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) throw new RemoteError('TURSO_DATABASE_URL must look like libsql://your-db-name.turso.io');

  /** Runs statements in order; returns [{ rows: [{col: value}], affected }] or throws. */
  async function execute(stmts) {
    const body = {
      requests: [...stmts.map((s) => ({ type: 'execute', stmt: { sql: s.sql, args: (s.args || []).map(toValue) } })), { type: 'close' }],
    };
    let res;
    try {
      res = await fetchImpl(`${base}/v2/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      throw new RemoteError(`Cannot reach Turso (${e?.name === 'TimeoutError' ? 'timeout' : e?.message || e})`);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new RemoteError(`Turso answered ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`, { status: res.status, auth: res.status === 401 || res.status === 403 });
    }
    const json = await res.json();
    return stmts.map((_, i) => {
      const r = json.results?.[i];
      if (!r || r.type !== 'ok') throw new RemoteError(`Turso error: ${r?.error?.message || 'unknown error'}`);
      const result = r.response?.result || { cols: [], rows: [] };
      const cols = (result.cols || []).map((c) => c.name);
      return {
        rows: (result.rows || []).map((row) => Object.fromEntries(cols.map((c, k) => [c, fromValue(row[k])]))),
        affected: Number(result.affected_row_count || 0),
      };
    });
  }

  return { execute, base };
}

// ---------------------------------------------------------------- backups of the database + photos
const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS sps_parts (snap INTEGER NOT NULL, part INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY (snap, part))',
  'CREATE TABLE IF NOT EXISTS sps_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS sps_files (path TEXT PRIMARY KEY, type TEXT NOT NULL, data BLOB NOT NULL, created_at TEXT NOT NULL)',
];

/**
 * turso:   createTurso(...)
 * dbFile:  path of the local SQLite file
 * Ownership: each server start claims the store. While a new server has not saved anything yet, the previous one
 * may still save its last changes (this covers the minute where both run during an update); the new server then
 * picks that copy up (see catchUp).
 */
export function createPersistence({ turso, dbFile, log = console.log, instanceId = randomBytes(6).toString('hex'), soon = SOON, later = LATER, retry = RETRY }) {
  let db = null; // set by attach()
  let dirty = false;
  let important = false;
  let importantSinceStart = false;
  let timer = null;
  let timerAt = 0;
  let running = null;
  let lastSnap = 0;
  let lostOwnership = false;
  const pendingFiles = [];

  const meta = async (key) => (await turso.execute([{ sql: 'SELECT value FROM sps_meta WHERE key = ?', args: [key] }]))[0].rows[0]?.value ?? null;

  async function download(latest) {
    const [r] = await turso.execute([{ sql: 'SELECT data FROM sps_parts WHERE snap = ? ORDER BY part', args: [latest.snap] }]);
    if (r.rows.length !== latest.parts) throw new RemoteError(`The saved copy ${latest.snap} is incomplete (${r.rows.length}/${latest.parts} parts)`);
    const bytes = gunzipSync(Buffer.concat(r.rows.map((x) => x.data)));
    if (bytes.subarray(0, 15).toString() !== 'SQLite format 3') throw new RemoteError('The saved copy is not a database');
    return bytes;
  }

  function writeDbFile(bytes) {
    for (const f of [`${dbFile}-wal`, `${dbFile}-shm`]) if (existsSync(f)) rmSync(f);
    writeFileSync(dbFile, bytes);
  }

  /** Before the database is opened: downloads the latest copy. Returns it, or null when nothing was saved yet. */
  async function restore() {
    await turso.execute(SCHEMA.map((sql) => ({ sql })));
    const raw = await meta('latest');
    const latest = raw ? JSON.parse(raw) : null;
    if (latest) {
      writeDbFile(await download(latest));
      lastSnap = latest.snap;
    }
    await turso.execute([
      { sql: "INSERT INTO sps_meta (key, value) VALUES ('owner', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [instanceId] },
      { sql: "INSERT INTO sps_meta (key, value) VALUES ('owner_published', '0') ON CONFLICT(key) DO UPDATE SET value = '0'" },
    ]);
    return latest;
  }

  function attach(database) {
    db = database;
  }

  function snapshotBytes() {
    const tmp = join(tmpdir(), `sps-snap-${instanceId}-${Date.now()}.db`);
    try {
      db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
      return readFileSync(tmp);
    } finally {
      rmSync(tmp, { force: true });
    }
  }

  async function publish() {
    const gz = gzipSync(snapshotBytes(), { level: 6 });
    const snap = Math.max(Date.now(), lastSnap + 1);
    const parts = [];
    for (let i = 0; i * PART_SIZE < gz.length || i === 0; i++) parts.push(gz.subarray(i * PART_SIZE, (i + 1) * PART_SIZE));
    // 1) the chunks
    for (let i = 0; i < parts.length; i++) {
      await turso.execute([{ sql: 'INSERT OR REPLACE INTO sps_parts (snap, part, data) VALUES (?, ?, ?)', args: [snap, i, parts[i]] }]);
    }
    // 2) point to it, only if this server still owns the store (or the new owner has not saved anything yet)
    const latest = JSON.stringify({ snap, parts: parts.length, size: gz.length, at: new Date().toISOString(), instance: instanceId });
    const [pointer] = await turso.execute([
      {
        sql: `INSERT INTO sps_meta (key, value) SELECT 'latest', ? WHERE (SELECT value FROM sps_meta WHERE key = 'owner') = ? OR (SELECT value FROM sps_meta WHERE key = 'owner_published') = '0'
              ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        args: [latest, instanceId],
      },
      { sql: "UPDATE sps_meta SET value = '1' WHERE key = 'owner_published' AND (SELECT value FROM sps_meta WHERE key = 'owner') = ?", args: [instanceId] },
    ]);
    if (!pointer.affected) {
      await turso.execute([{ sql: 'DELETE FROM sps_parts WHERE snap = ?', args: [snap] }]);
      lostOwnership = true;
      throw new RemoteError('A newer server has taken over; this one stops saving');
    }
    lastSnap = snap;
    // 3) clean up old copies
    await turso.execute([
      {
        sql: `DELETE FROM sps_parts WHERE snap NOT IN (SELECT snap FROM (SELECT DISTINCT snap FROM sps_parts ORDER BY snap DESC LIMIT ${KEEP_COPIES}))
              AND snap <> ?`,
        args: [snap],
      },
    ]);
  }

  async function uploadPendingFiles() {
    while (pendingFiles.length) {
      const batch = pendingFiles.splice(0, 20);
      try {
        await turso.execute(batch.map((f) => ({ sql: 'INSERT OR REPLACE INTO sps_files (path, type, data, created_at) VALUES (?, ?, ?, ?)', args: [f.path, f.type, f.data, new Date().toISOString()] })));
      } catch (e) {
        pendingFiles.unshift(...batch);
        throw e;
      }
    }
  }

  async function flush() {
    timer = null;
    timerAt = 0;
    if (lostOwnership || !db) return;
    if (running) {
      await running.catch(() => {});
      if (dirty) return flush();
      return;
    }
    if (!dirty && !pendingFiles.length) return;
    const wasImportant = important;
    dirty = false;
    important = false;
    running = (async () => {
      await uploadPendingFiles();
      await publish();
    })();
    try {
      await running;
    } catch (e) {
      if (!lostOwnership) {
        dirty = true;
        important = important || wasImportant;
        schedule(retry);
      }
      log(`[backup] ${e.message}`);
    } finally {
      running = null;
    }
  }

  function schedule(delay) {
    if (lostOwnership) return;
    const at = Date.now() + delay;
    if (timer && timerAt <= at) return;
    clearTimeout(timer);
    timerAt = at;
    timer = setTimeout(flush, delay);
    timer.unref?.();
  }

  /** Called after every write to the database. */
  function markDirty(isImportant) {
    dirty = true;
    if (isImportant) {
      important = true;
      importantSinceStart = true;
    }
    schedule(important ? soon : later);
  }

  /** Saves everything now (used right after start-up and when the server stops). */
  async function flushNow() {
    clearTimeout(timer);
    timer = null;
    timerAt = 0;
    if (running) await running.catch(() => {});
    if (dirty || pendingFiles.length) await flush();
  }

  // ---------- photos
  function queueFile(path, type, data) {
    pendingFiles.push({ path, type, data: Buffer.from(data) });
  }
  async function putFile(path, type, data) {
    await turso.execute([{ sql: 'INSERT OR REPLACE INTO sps_files (path, type, data, created_at) VALUES (?, ?, ?, ?)', args: [path, type, Buffer.from(data), new Date().toISOString()] }]);
  }
  async function getFile(path) {
    const [r] = await turso.execute([{ sql: 'SELECT type, data FROM sps_files WHERE path = ?', args: [path] }]);
    return r.rows[0] || null;
  }

  /**
   * For a few minutes after start-up, picks up a copy saved by the previous server (orders it took while this one
   * was starting). reload(bytes) must swap the open database for the given file content.
   */
  function catchUp(reload, { every = 10000, during = 3 * 60 * 1000 } = {}) {
    const until = Date.now() + during;
    const tick = async () => {
      if (Date.now() > until || lostOwnership) return;
      try {
        const raw = await meta('latest');
        const latest = raw ? JSON.parse(raw) : null;
        if (latest && latest.snap > lastSnap && latest.instance !== instanceId) {
          if (importantSinceStart) {
            log('[backup] The previous server saved changes after this one started, and this one already has new changes. Keeping the newest.');
            return;
          }
          reload(await download(latest));
          lastSnap = latest.snap;
          dirty = false;
          log(`[backup] Picked up the last changes saved by the previous server (${latest.at}).`);
        }
      } catch (e) {
        log(`[backup] ${e.message}`);
      }
      const t = setTimeout(tick, every);
      t.unref?.();
    };
    const t = setTimeout(tick, every);
    t.unref?.();
  }

  return {
    instanceId,
    restore,
    attach,
    markDirty,
    flushNow,
    queueFile,
    putFile,
    getFile,
    uploadPendingFiles,
    catchUp,
    get lostOwnership() {
      return lostOwnership;
    },
  };
}

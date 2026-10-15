// SQLite through Node's built-in driver (node:sqlite) — no native modules to compile.
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const norm = (params) => params.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));

/**
 * openDb(file, { onWrite }) -> { get, all, run, exec, close, reload, raw }
 * onWrite() is called after every statement that may change data (used to schedule backups).
 */
export function openDb(file, { onWrite } = {}) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  let raw = null;
  const cache = new Map();
  const open = () => {
    raw = new DatabaseSync(file);
    raw.exec('PRAGMA journal_mode = WAL');
    raw.exec('PRAGMA synchronous = NORMAL');
    raw.exec('PRAGMA busy_timeout = 5000');
    raw.exec('PRAGMA foreign_keys = ON');
    cache.clear();
  };
  open();

  const prep = (sql) => {
    let s = cache.get(sql);
    if (!s) {
      if (cache.size > 400) cache.clear();
      s = raw.prepare(sql);
      cache.set(sql, s);
    }
    return s;
  };
  // node:sqlite returns null-prototype rows; plain objects are friendlier everywhere else.
  const plain = (row) => (row ? { ...row } : undefined);
  const wrote = () => onWrite?.();

  const db = {
    get: (sql, ...p) => plain(prep(sql).get(...norm(p))),
    all: (sql, ...p) => prep(sql).all(...norm(p)).map((r) => ({ ...r })),
    run: (sql, ...p) => {
      const r = prep(sql).run(...norm(p));
      if (r.changes) wrote();
      return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
    },
    exec: (sql) => {
      raw.exec(sql);
      if (!/^\s*(PRAGMA|BEGIN|COMMIT|ROLLBACK|VACUUM\s+INTO)\b/i.test(sql)) wrote();
    },
    close: () => raw.close(),
    /** Replaces the whole database with the given file content (used when a newer backup is picked up). */
    reload: (bytes) => {
      raw.close();
      for (const f of [`${file}-wal`, `${file}-shm`]) if (existsSync(f)) rmSync(f);
      writeFileSync(file, bytes);
      open();
    },
    get raw() {
      return raw;
    },
  };
  return db;
}

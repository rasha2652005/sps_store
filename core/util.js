// Small helpers shared by every route. No Node-only APIs here: this folder also runs in the browser demo.

export const isoNow = () => new Date().toISOString();
export const daysAgoIso = (d) => new Date(Date.now() - d * 86400000).toISOString();

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export function parseJson(s, fallback) {
  if (s == null || s === '') return fallback;
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

/** Trimmed string, capped length; null/undefined -> '' */
export const str = (v, max = 500) => (v == null ? '' : String(v)).trim().slice(0, max);

/** Optional string: '' -> null */
export const optStr = (v, max = 500) => {
  const s = str(v, max);
  return s === '' ? null : s;
};

export function int(v, def = 0, min = -Infinity, max = Infinity) {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

export function num(v, def = 0, min = -Infinity, max = Infinity) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

export const bool = (v) => v === true || v === 1 || v === '1' || v === 'true' || v === 'on';

export function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function uniqueSlug(db, table, base, excludeId = null) {
  const root = slugify(base) || `${table.slice(0, -1)}-${Math.random().toString(36).slice(2, 7)}`;
  let slug = root;
  for (let i = 2; i < 500; i++) {
    const row = db.get(`SELECT id FROM ${table} WHERE slug = ?`, slug);
    if (!row || row.id === excludeId) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export const westernDigits = (s) =>
  String(s ?? '')
    .replace(/[٠-٩]/g, (d) => AR_DIGITS.indexOf(d))
    .replace(/[۰-۹]/g, (d) => FA_DIGITS.indexOf(d));

/**
 * Normalizes phone numbers to E.164. Lebanese numbers can be typed any common way:
 * "70 123 456", "03 123 456", "+961 70123456", "0096170123456", "٧٠١٢٣٤٥٦".
 * Returns null when the number is not valid.
 */
export function normalizePhone(input) {
  const raw = westernDigits(String(input || '').trim());
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  let intl = raw.startsWith('+');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
    intl = true;
  }
  if (intl && !digits.startsWith('961')) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (digits.startsWith('961') && digits.length >= 10) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (/^[1-9]\d{6}$/.test(digits) || /^(7[0-9]|8[0-9])\d{6}$/.test(digits)) return `+961${digits}`;
  return null;
}

export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || ''));

/** "+96170123456" -> "+961 70 123 456" (other countries are returned as-is). */
export function prettyPhone(e164) {
  const s = String(e164 || '');
  const m = /^\+961(\d)(\d{6})$/.exec(s) || /^\+961(\d{2})(\d{6})$/.exec(s);
  if (!m) return s;
  return `+961 ${m[1]} ${m[2].slice(0, 3)} ${m[2].slice(3)}`;
}

// ---- crypto helpers (Web Crypto: available in Node 20+ and every modern browser) ----
const b64chars = (bytes) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};
export const toB64 = (bytes) => b64chars(bytes);
export const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const toB64Url = (bytes) => b64chars(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function randomToken(bytes = 32) {
  return toB64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function randomHex(bytes = 8) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const escapeLike = (s) => String(s).replace(/[\\%_]/g, (c) => '\\' + c);

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

export function randomDigits(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  if (s[0] === '0') s = String(1 + Math.floor(Math.random() * 9)) + s.slice(1);
  return s;
}

/** Runs fn inside a transaction (nested calls just join the outer one). */
export function tx(db, fn) {
  if (db._txDepth) {
    return fn();
  }
  db._txDepth = 1;
  db.exec('BEGIN');
  try {
    const out = fn();
    if (out && typeof out.then === 'function') throw new Error('tx() callback must be synchronous');
    db.exec('COMMIT');
    return out;
  } catch (e) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    db._txDepth = 0;
  }
}

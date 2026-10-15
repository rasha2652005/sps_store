// Passwords (PBKDF2-SHA256 via Web Crypto), sessions and a tiny in-memory rate limiter.
// No Node-only APIs: this file also runs inside the browser demo.
import { fromB64, isoNow, randomToken, sha256Hex, toB64 } from './util.js';
import { tooMany } from './errors.js';

export const AUTH = {
  // OWASP recommends >= 600k for PBKDF2-SHA256; 310k keeps logins fast on small servers.
  iterations: 310000,
  sessionDays: { customer: 60, admin: 7 },
  cookie: { customer: 'sps_c', admin: 'sps_a' },
};

const enc = new TextEncoder();

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password, iterations = AUTH.iterations) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, iterations);
  return `pbkdf2$${iterations}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 1000) return false;
  const expected = fromB64(parts[3]);
  const got = await derive(password, fromB64(parts[2]), iterations);
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ expected[i];
  return diff === 0;
}

export function passwordProblem(pw) {
  const s = String(pw || '');
  if (s.length < 8) return 'password_too_short';
  if (s.length > 200) return 'password_too_long';
  return null;
}

// ---------------- sessions ----------------
export async function createSession(db, kind, userId) {
  const token = randomToken(32);
  const days = AUTH.sessionDays[kind] || 30;
  const expires = new Date(Date.now() + days * 86400000).toISOString();
  db.run(
    'INSERT INTO sessions (token_hash, kind, user_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
    await sha256Hex(token),
    kind,
    userId,
    expires,
    isoNow(),
  );
  // Opportunistic cleanup of expired sessions.
  if (Math.random() < 0.05) db.run('DELETE FROM sessions WHERE expires_at < ?', isoNow());
  return { token, maxAgeSeconds: days * 86400 };
}

/** Returns the user row for a session token, or null. */
export async function readSession(db, kind, token) {
  if (!token || typeof token !== 'string' || token.length > 200) return null;
  const hash = await sha256Hex(token);
  const s = db.get('SELECT user_id, expires_at FROM sessions WHERE token_hash = ? AND kind = ?', hash, kind);
  if (!s || s.expires_at < isoNow()) return null;
  if (kind === 'admin') {
    return db.get('SELECT id, name, email, role, created_at, last_login_at FROM admins WHERE id = ?', s.user_id) || null;
  }
  const c = db.get('SELECT id, name, phone, email, blocked, created_at FROM customers WHERE id = ?', s.user_id);
  if (!c || c.blocked) return null;
  return c;
}

export async function destroySession(db, token) {
  if (!token) return;
  db.run('DELETE FROM sessions WHERE token_hash = ?', await sha256Hex(token));
}

export function destroyUserSessions(db, kind, userId) {
  db.run('DELETE FROM sessions WHERE kind = ? AND user_id = ?', kind, userId);
}

// ---------------- rate limiting ----------------
const buckets = new Map();

/** Throws 429 after `max` hits within `windowMs` for the same key. */
export function rateLimit(key, max = 8, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset < now) {
    b = { count: 0, reset: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  }
  if (b.count > max) throw tooMany();
}

export function clearRateLimit(key) {
  buckets.delete(key);
}

// Admin accounts: first-run setup, login, team members.
import { bad, conflict, forbidden, notFound, unauthorized } from '../../errors.js';
import {
  AUTH,
  clearRateLimit,
  createSession,
  destroySession,
  destroyUserSessions,
  hashPassword,
  passwordProblem,
  rateLimit,
  verifyPassword,
} from '../../auth.js';
import { int, isEmail, isoNow, str } from '../../util.js';

const shape = (a) => ({ id: a.id, name: a.name, email: a.email, role: a.role, created_at: a.created_at, last_login_at: a.last_login_at });
const iterations = (ctx) => (ctx.env.demo ? 20000 : AUTH.iterations);

export async function setupStatus(ctx) {
  const n = ctx.db.get('SELECT COUNT(*) AS n FROM admins').n;
  return { needs_setup: n === 0 };
}

/** Creates the first (owner) account. Only works while there is no admin at all. */
export async function setup(ctx) {
  rateLimit(`setup:${ctx.ip}`, 10, 60 * 60 * 1000);
  if (ctx.db.get('SELECT COUNT(*) AS n FROM admins').n > 0) throw forbidden('already_setup', 'The store already has an admin');
  const b = ctx.body || {};
  const name = str(b.name, 80);
  const email = str(b.email, 120).toLowerCase();
  if (name.length < 2) throw bad('name_required', 'Please enter your name', { field: 'name' });
  if (!isEmail(email)) throw bad('email_invalid', 'Please enter a valid email', { field: 'email' });
  const p = passwordProblem(b.password);
  if (p) throw bad(p, 'Password must be at least 8 characters', { field: 'password' });
  const now = isoNow();
  const r = ctx.db.run(
    "INSERT INTO admins (name, email, password_hash, role, created_at, last_login_at) VALUES (?, ?, ?, 'owner', ?, ?)",
    name,
    email,
    await hashPassword(b.password, iterations(ctx)),
    now,
    now,
  );
  const s = await createSession(ctx.db, 'admin', r.lastInsertRowid);
  ctx.setCookie(AUTH.cookie.admin, s.token, s.maxAgeSeconds);
  return { admin: shape(ctx.db.get('SELECT * FROM admins WHERE id = ?', r.lastInsertRowid)) };
}

export async function login(ctx) {
  const b = ctx.body || {};
  const email = str(b.email, 120).toLowerCase();
  const key = `admin-login:${ctx.ip}:${email}`;
  rateLimit(key, 6, 15 * 60 * 1000);
  rateLimit(`admin-login-ip:${ctx.ip}`, 30, 15 * 60 * 1000);
  const a = ctx.db.get('SELECT * FROM admins WHERE email = ?', email);
  if (!a || !(await verifyPassword(b.password, a.password_hash))) throw unauthorized('invalid_login', 'Wrong email or password');
  clearRateLimit(key);
  ctx.db.run('UPDATE admins SET last_login_at = ? WHERE id = ?', isoNow(), a.id);
  const s = await createSession(ctx.db, 'admin', a.id);
  ctx.setCookie(AUTH.cookie.admin, s.token, s.maxAgeSeconds);
  return { admin: shape(a) };
}

export async function logout(ctx) {
  await destroySession(ctx.db, ctx.cookie(AUTH.cookie.admin));
  ctx.clearCookie(AUTH.cookie.admin);
  return { ok: true };
}

export async function me(ctx) {
  return { admin: ctx.admin ? shape(ctx.admin) : null };
}

export async function changePassword(ctx) {
  const b = ctx.body || {};
  const a = ctx.db.get('SELECT * FROM admins WHERE id = ?', ctx.admin.id);
  rateLimit(`admin-pw:${a.id}`, 8, 15 * 60 * 1000);
  if (!(await verifyPassword(b.current, a.password_hash))) throw bad('wrong_password', 'Current password is wrong', { field: 'current' });
  const p = passwordProblem(b.password);
  if (p) throw bad(p, 'Password must be at least 8 characters', { field: 'password' });
  ctx.db.run('UPDATE admins SET password_hash = ? WHERE id = ?', await hashPassword(b.password, iterations(ctx)), a.id);
  destroyUserSessions(ctx.db, 'admin', a.id);
  const s = await createSession(ctx.db, 'admin', a.id);
  ctx.setCookie(AUTH.cookie.admin, s.token, s.maxAgeSeconds);
  return { ok: true };
}

export async function team(ctx) {
  return { items: ctx.db.all('SELECT * FROM admins ORDER BY id').map(shape) };
}

export async function addMember(ctx) {
  const b = ctx.body || {};
  const name = str(b.name, 80);
  const email = str(b.email, 120).toLowerCase();
  if (name.length < 2) throw bad('name_required', 'Please enter a name', { field: 'name' });
  if (!isEmail(email)) throw bad('email_invalid', 'Please enter a valid email', { field: 'email' });
  const p = passwordProblem(b.password);
  if (p) throw bad(p, 'Password must be at least 8 characters', { field: 'password' });
  if (ctx.db.get('SELECT id FROM admins WHERE email = ?', email)) throw conflict('email_taken', 'This email already has access', { field: 'email' });
  const role = b.role === 'owner' ? 'owner' : 'staff';
  ctx.db.run(
    'INSERT INTO admins (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
    name,
    email,
    await hashPassword(b.password, iterations(ctx)),
    role,
    isoNow(),
  );
  return team(ctx);
}

export async function removeMember(ctx) {
  const id = int(ctx.params.id, 0);
  if (id === ctx.admin.id) throw bad('cannot_remove_self', 'You cannot remove yourself');
  const a = ctx.db.get('SELECT * FROM admins WHERE id = ?', id);
  if (!a) throw notFound('admin_not_found', 'Not found');
  if (a.role === 'owner' && ctx.db.get("SELECT COUNT(*) AS n FROM admins WHERE role = 'owner'").n <= 1) {
    throw bad('last_owner', 'The store needs at least one owner');
  }
  ctx.db.run('DELETE FROM admins WHERE id = ?', id);
  destroyUserSessions(ctx.db, 'admin', id);
  return team(ctx);
}

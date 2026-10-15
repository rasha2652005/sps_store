// Turns a plain request object into a response object. Used by the Express server and by the in-browser demo,
// so authentication, permissions and error handling behave exactly the same in both.
import { createRouter } from './router.js';
import { routes } from './routes.js';
import { HttpError, forbidden, unauthorized } from './errors.js';
import { AUTH, readSession } from './auth.js';
import { getSettings } from './settings.js';

const router = createRouter(routes);

/**
 * req: { method, path, query, body, cookies, ip }
 * env: { db, storage, demo, prod, emit, log }
 * returns { status, json | raw, cookies: [{ name, value, maxAge }] }
 */
export async function dispatch(req, env) {
  const m = router.match(req.method, req.path);
  if (!m) return { status: 404, json: { error: { code: 'not_found', message: 'Not found' } }, cookies: [] };
  if (m.methodNotAllowed) return { status: 405, json: { error: { code: 'method_not_allowed', message: 'Method not allowed' } }, cookies: [] };

  const cookies = [];
  let settingsCache;
  const ctx = {
    db: env.db,
    env: { demo: !!env.demo, prod: !!env.prod },
    storage: env.storage,
    emit: env.emit,
    params: m.params,
    query: req.query || {},
    body: req.body && typeof req.body === 'object' ? req.body : {},
    ip: req.ip || 'local',
    settings: () => (settingsCache ||= getSettings(env.db)),
    cookie: (name) => req.cookies?.[name],
    setCookie: (name, value, maxAge) => cookies.push({ name, value, maxAge }),
    clearCookie: (name) => cookies.push({ name, value: '', maxAge: 0 }),
    customer: null,
    admin: null,
  };

  try {
    const cTok = req.cookies?.[AUTH.cookie.customer];
    if (cTok) {
      ctx.customer = await readSession(env.db, 'customer', cTok);
      if (!ctx.customer) ctx.clearCookie(AUTH.cookie.customer);
    }
    const aTok = req.cookies?.[AUTH.cookie.admin];
    if (aTok && req.path.startsWith('/api/admin')) {
      ctx.admin = await readSession(env.db, 'admin', aTok);
      if (!ctx.admin) ctx.clearCookie(AUTH.cookie.admin);
    }
    const auth = m.route.auth;
    if (auth === 'customer' && !ctx.customer) throw unauthorized('login_required', 'Please log in');
    if ((auth === 'admin' || auth === 'owner') && !ctx.admin) throw unauthorized('admin_login_required', 'Please log in to the admin panel');
    if (auth === 'owner' && ctx.admin.role !== 'owner') throw forbidden('owner_only', 'Only the store owner can change this');

    const out = await m.route.handler(ctx);
    if (out && out.$raw) return { status: 200, raw: out.$raw, cookies };
    return { status: 200, json: out ?? { ok: true }, cookies };
  } catch (e) {
    if (e instanceof HttpError) {
      return { status: e.status, json: { error: { code: e.code, message: e.message, details: e.details ?? null } }, cookies };
    }
    env.log?.(e);
    return { status: 500, json: { error: { code: 'server_error', message: 'Something went wrong, please try again' } }, cookies };
  }
}

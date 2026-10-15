// Customer accounts: register, login, profile, addresses, wishlist, order history.
import { bad, conflict, notFound, unauthorized } from '../errors.js';
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
} from '../auth.js';
import { int, isEmail, isoNow, normalizePhone, optStr, str } from '../util.js';

const publicCustomer = (c) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email || '', created_at: c.created_at });

function meData(db, c) {
  const wishlist = db.all('SELECT product_id FROM wishlist WHERE customer_id = ? ORDER BY created_at DESC', c.id).map((r) => r.product_id);
  const addresses = db.all('SELECT * FROM addresses WHERE customer_id = ? ORDER BY is_default DESC, id DESC', c.id);
  return { customer: publicCustomer(c), wishlist, addresses };
}

export async function register(ctx) {
  rateLimit(`register:${ctx.ip}`, 10, 60 * 60 * 1000);
  const b = ctx.body || {};
  const name = str(b.name, 80);
  if (name.length < 2) throw bad('name_required', 'Please enter your name', { field: 'name' });
  const phone = normalizePhone(b.phone);
  if (!phone) throw bad('phone_invalid', 'Please enter a valid phone number', { field: 'phone' });
  const email = optStr(b.email, 120)?.toLowerCase() || null;
  if (email && !isEmail(email)) throw bad('email_invalid', 'Please enter a valid email', { field: 'email' });
  const pwProblem = passwordProblem(b.password);
  if (pwProblem) throw bad(pwProblem, 'Password must be at least 8 characters', { field: 'password' });
  if (ctx.db.get('SELECT id FROM customers WHERE phone = ?', phone)) throw conflict('phone_taken', 'An account with this phone already exists', { field: 'phone' });
  if (email && ctx.db.get('SELECT id FROM customers WHERE email = ?', email)) throw conflict('email_taken', 'An account with this email already exists', { field: 'email' });
  const hash = await hashPassword(b.password, ctx.env.demo ? 20000 : AUTH.iterations);
  const now = isoNow();
  const r = ctx.db.run(
    'INSERT INTO customers (name, phone, email, password_hash, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?)',
    name,
    phone,
    email,
    hash,
    now,
    now,
  );
  const c = ctx.db.get('SELECT * FROM customers WHERE id = ?', r.lastInsertRowid);
  const s = await createSession(ctx.db, 'customer', c.id);
  ctx.setCookie(AUTH.cookie.customer, s.token, s.maxAgeSeconds);
  return meData(ctx.db, c);
}

export async function login(ctx) {
  const b = ctx.body || {};
  const raw = str(b.login, 120);
  const key = `login:${ctx.ip}:${raw.toLowerCase()}`;
  rateLimit(key, 8, 15 * 60 * 1000);
  const phone = normalizePhone(raw);
  const c = isEmail(raw)
    ? ctx.db.get('SELECT * FROM customers WHERE email = ?', raw.toLowerCase())
    : phone
      ? ctx.db.get('SELECT * FROM customers WHERE phone = ?', phone)
      : null;
  const ok = c && (await verifyPassword(b.password, c.password_hash));
  if (!ok) throw unauthorized('invalid_login', 'Wrong phone/email or password');
  if (c.blocked) throw unauthorized('account_blocked', 'This account is disabled, please contact the store');
  clearRateLimit(key);
  ctx.db.run('UPDATE customers SET last_login_at = ? WHERE id = ?', isoNow(), c.id);
  const s = await createSession(ctx.db, 'customer', c.id);
  ctx.setCookie(AUTH.cookie.customer, s.token, s.maxAgeSeconds);
  return meData(ctx.db, c);
}

export async function logout(ctx) {
  await destroySession(ctx.db, ctx.cookie(AUTH.cookie.customer));
  ctx.clearCookie(AUTH.cookie.customer);
  return { ok: true };
}

export async function me(ctx) {
  if (!ctx.customer) return { customer: null, wishlist: [], addresses: [] };
  return meData(ctx.db, ctx.customer);
}

export async function updateProfile(ctx) {
  const b = ctx.body || {};
  const name = str(b.name, 80);
  if (name.length < 2) throw bad('name_required', 'Please enter your name', { field: 'name' });
  const email = optStr(b.email, 120)?.toLowerCase() || null;
  if (email && !isEmail(email)) throw bad('email_invalid', 'Please enter a valid email', { field: 'email' });
  if (email && ctx.db.get('SELECT id FROM customers WHERE email = ? AND id != ?', email, ctx.customer.id)) {
    throw conflict('email_taken', 'An account with this email already exists', { field: 'email' });
  }
  ctx.db.run('UPDATE customers SET name = ?, email = ? WHERE id = ?', name, email, ctx.customer.id);
  return meData(ctx.db, ctx.db.get('SELECT * FROM customers WHERE id = ?', ctx.customer.id));
}

export async function changePassword(ctx) {
  const b = ctx.body || {};
  const c = ctx.db.get('SELECT * FROM customers WHERE id = ?', ctx.customer.id);
  rateLimit(`pw:${c.id}`, 8, 15 * 60 * 1000);
  if (!(await verifyPassword(b.current, c.password_hash))) throw bad('wrong_password', 'Current password is wrong', { field: 'current' });
  const p = passwordProblem(b.password);
  if (p) throw bad(p, 'Password must be at least 8 characters', { field: 'password' });
  ctx.db.run('UPDATE customers SET password_hash = ? WHERE id = ?', await hashPassword(b.password, ctx.env.demo ? 20000 : AUTH.iterations), c.id);
  destroyUserSessions(ctx.db, 'customer', c.id);
  const s = await createSession(ctx.db, 'customer', c.id);
  ctx.setCookie(AUTH.cookie.customer, s.token, s.maxAgeSeconds);
  return { ok: true };
}

export async function myOrders(ctx) {
  const rows = ctx.db.all(
    `SELECT o.id, o.number, o.access_key, o.status, o.total, o.payment_method, o.payment_status, o.delivery_method, o.created_at,
       (SELECT SUM(qty) FROM order_items WHERE order_id = o.id) AS items,
       (SELECT image FROM order_items WHERE order_id = o.id ORDER BY id LIMIT 1) AS image
     FROM orders o WHERE o.customer_id = ? ORDER BY o.id DESC LIMIT 100`,
    ctx.customer.id,
  );
  const images = (id) => ctx.db.all('SELECT image FROM order_items WHERE order_id = ? ORDER BY id LIMIT 4', id).map((r) => r.image);
  return { items: rows.map(({ id, access_key, ...r }) => ({ ...r, key: access_key, images: images(id) })) };
}

function cleanAddress(settings, b) {
  const zone = (settings.delivery.zones || []).find((z) => z.id === b.zone);
  if (!zone) throw bad('zone_required', 'Please choose your area', { field: 'zone' });
  const city = str(b.city, 60);
  if (city.length < 2) throw bad('city_required', 'Please enter your city / town', { field: 'city' });
  const street = str(b.street, 120);
  if (street.length < 2) throw bad('street_required', 'Please enter your street', { field: 'street' });
  return {
    label: optStr(b.label, 40),
    zone: zone.id,
    city,
    street,
    building: optStr(b.building, 60),
    floor: optStr(b.floor, 20),
    details: optStr(b.details, 300),
    is_default: b.is_default ? 1 : 0,
  };
}

export async function addAddress(ctx) {
  const a = cleanAddress(ctx.settings(), ctx.body || {});
  const n = ctx.db.get('SELECT COUNT(*) AS n FROM addresses WHERE customer_id = ?', ctx.customer.id).n;
  if (n >= 10) throw bad('too_many_addresses', 'You can save up to 10 addresses');
  if (!n) a.is_default = 1;
  if (a.is_default) ctx.db.run('UPDATE addresses SET is_default = 0 WHERE customer_id = ?', ctx.customer.id);
  ctx.db.run(
    'INSERT INTO addresses (customer_id, label, zone, city, street, building, floor, details, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ctx.customer.id,
    a.label,
    a.zone,
    a.city,
    a.street,
    a.building,
    a.floor,
    a.details,
    a.is_default,
    isoNow(),
  );
  return meData(ctx.db, ctx.customer);
}

export async function updateAddress(ctx) {
  const id = int(ctx.params.id, 0);
  const cur = ctx.db.get('SELECT * FROM addresses WHERE id = ? AND customer_id = ?', id, ctx.customer.id);
  if (!cur) throw notFound('address_not_found', 'Address not found');
  const a = cleanAddress(ctx.settings(), ctx.body || {});
  if (a.is_default) ctx.db.run('UPDATE addresses SET is_default = 0 WHERE customer_id = ?', ctx.customer.id);
  ctx.db.run(
    'UPDATE addresses SET label = ?, zone = ?, city = ?, street = ?, building = ?, floor = ?, details = ?, is_default = ? WHERE id = ?',
    a.label,
    a.zone,
    a.city,
    a.street,
    a.building,
    a.floor,
    a.details,
    a.is_default || cur.is_default,
    id,
  );
  return meData(ctx.db, ctx.customer);
}

export async function deleteAddress(ctx) {
  const id = int(ctx.params.id, 0);
  const cur = ctx.db.get('SELECT * FROM addresses WHERE id = ? AND customer_id = ?', id, ctx.customer.id);
  if (!cur) throw notFound('address_not_found', 'Address not found');
  ctx.db.run('DELETE FROM addresses WHERE id = ?', id);
  if (cur.is_default) {
    const next = ctx.db.get('SELECT id FROM addresses WHERE customer_id = ? ORDER BY id DESC LIMIT 1', ctx.customer.id);
    if (next) ctx.db.run('UPDATE addresses SET is_default = 1 WHERE id = ?', next.id);
  }
  return meData(ctx.db, ctx.customer);
}

export async function wishlistToggle(ctx) {
  const productId = int(ctx.body?.product_id, 0);
  if (!ctx.db.get('SELECT id FROM products WHERE id = ?', productId)) throw notFound('product_not_found', 'Product not found');
  if (ctx.body?.on) {
    ctx.db.run('INSERT OR IGNORE INTO wishlist (customer_id, product_id, created_at) VALUES (?, ?, ?)', ctx.customer.id, productId, isoNow());
  } else {
    ctx.db.run('DELETE FROM wishlist WHERE customer_id = ? AND product_id = ?', ctx.customer.id, productId);
  }
  return { wishlist: ctx.db.all('SELECT product_id FROM wishlist WHERE customer_id = ? ORDER BY created_at DESC', ctx.customer.id).map((r) => r.product_id) };
}

/** Merges a guest wishlist (from the browser) into the account after login. */
export async function wishlistMerge(ctx) {
  const ids = (Array.isArray(ctx.body?.product_ids) ? ctx.body.product_ids : []).slice(0, 100).map((x) => int(x, 0)).filter(Boolean);
  for (const id of ids) {
    if (ctx.db.get('SELECT id FROM products WHERE id = ?', id)) {
      ctx.db.run('INSERT OR IGNORE INTO wishlist (customer_id, product_id, created_at) VALUES (?, ?, ?)', ctx.customer.id, id, isoNow());
    }
  }
  return { wishlist: ctx.db.all('SELECT product_id FROM wishlist WHERE customer_id = ? ORDER BY created_at DESC', ctx.customer.id).map((r) => r.product_id) };
}

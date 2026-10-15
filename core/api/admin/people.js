// Admin: customers, reviews moderation, back-in-stock requests and trade-in requests.
import { notFound } from '../../errors.js';
import { AUTH, destroyUserSessions, hashPassword } from '../../auth.js';
import { refreshRating } from '../../catalog.js';
import { bumpCatalog } from '../../schema.js';
import { escapeLike, int, isoNow, normalizePhone, num, optStr, parseJson, randomDigits, round2 } from '../../util.js';

export async function customers(ctx) {
  const page = int(ctx.query.page, 1, 1, 10000);
  const limit = 25;
  const q = String(ctx.query.q || '').trim();
  const where = [];
  const args = [];
  if (q) {
    const like = `%${escapeLike(q)}%`;
    where.push("(c.name LIKE ? ESCAPE '\\' OR c.phone LIKE ? ESCAPE '\\' OR c.email LIKE ? ESCAPE '\\' OR c.phone = ?)");
    args.push(like, like, like, normalizePhone(q) || '');
  }
  const sql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = ctx.db.get(`SELECT COUNT(*) AS n FROM customers c ${sql}`, ...args).n;
  const items = ctx.db.all(
    `SELECT c.id, c.name, c.phone, c.email, c.blocked, c.created_at, c.last_login_at,
       (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id AND o.status != 'cancelled') AS orders,
       (SELECT IFNULL(SUM(total), 0) FROM orders o WHERE o.customer_id = c.id AND o.status != 'cancelled') AS spent,
       (SELECT MAX(created_at) FROM orders o WHERE o.customer_id = c.id) AS last_order_at
     FROM customers c ${sql} ORDER BY c.id DESC LIMIT ? OFFSET ?`,
    ...args,
    limit,
    (page - 1) * limit,
  );
  return { items: items.map((c) => ({ ...c, blocked: !!c.blocked, spent: round2(c.spent) })), total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function customer(ctx) {
  const id = int(ctx.params.id, 0);
  const c = ctx.db.get('SELECT id, name, phone, email, blocked, created_at, last_login_at FROM customers WHERE id = ?', id);
  if (!c) throw notFound('customer_not_found', 'Customer not found');
  const orders = ctx.db.all('SELECT id, number, status, total, payment_method, payment_status, created_at FROM orders WHERE customer_id = ? ORDER BY id DESC LIMIT 50', id);
  const addresses = ctx.db.all('SELECT * FROM addresses WHERE customer_id = ? ORDER BY is_default DESC, id DESC', id);
  const stats = ctx.db.get("SELECT COUNT(*) AS n, IFNULL(SUM(total), 0) AS spent FROM orders WHERE customer_id = ? AND status != 'cancelled'", id);
  return { customer: { ...c, blocked: !!c.blocked, orders_count: stats.n, spent: round2(stats.spent) }, orders, addresses };
}

export async function patchCustomer(ctx) {
  const id = int(ctx.params.id, 0);
  if (!ctx.db.get('SELECT id FROM customers WHERE id = ?', id)) throw notFound('customer_not_found', 'Customer not found');
  if (ctx.body?.blocked !== undefined) {
    ctx.db.run('UPDATE customers SET blocked = ? WHERE id = ?', ctx.body.blocked ? 1 : 0, id);
    if (ctx.body.blocked) destroyUserSessions(ctx.db, 'customer', id);
  }
  return customer(ctx);
}

/** Generates a temporary password the shop can send to the customer (e.g. on WhatsApp). */
export async function resetCustomerPassword(ctx) {
  const id = int(ctx.params.id, 0);
  if (!ctx.db.get('SELECT id FROM customers WHERE id = ?', id)) throw notFound('customer_not_found', 'Customer not found');
  const temp = `sps-${randomDigits(6)}`;
  ctx.db.run('UPDATE customers SET password_hash = ? WHERE id = ?', await hashPassword(temp, ctx.env.demo ? 20000 : AUTH.iterations), id);
  destroyUserSessions(ctx.db, 'customer', id);
  return { temp_password: temp };
}

// ---------------- reviews ----------------
export async function reviews(ctx) {
  const page = int(ctx.query.page, 1, 1, 10000);
  const where = ctx.query.hidden === '1' ? 'WHERE r.hidden = 1' : '';
  const total = ctx.db.get(`SELECT COUNT(*) AS n FROM reviews r ${where}`).n;
  const items = ctx.db.all(
    `SELECT r.*, p.name_en, p.slug, p.images FROM reviews r JOIN products p ON p.id = r.product_id ${where} ORDER BY r.id DESC LIMIT 25 OFFSET ?`,
    (page - 1) * 25,
  );
  return {
    items: items.map((r) => ({ ...r, hidden: !!r.hidden, verified: !!r.verified, image: parseJson(r.images, [])[0]?.url || '', images: undefined })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / 25)),
  };
}

export async function patchReview(ctx) {
  const r = ctx.db.get('SELECT * FROM reviews WHERE id = ?', int(ctx.params.id, 0));
  if (!r) throw notFound('review_not_found', 'Review not found');
  ctx.db.run('UPDATE reviews SET hidden = ? WHERE id = ?', ctx.body?.hidden ? 1 : 0, r.id);
  refreshRating(ctx.db, r.product_id);
  bumpCatalog(ctx.db);
  return { ok: true };
}

export async function deleteReview(ctx) {
  const r = ctx.db.get('SELECT * FROM reviews WHERE id = ?', int(ctx.params.id, 0));
  if (!r) throw notFound('review_not_found', 'Review not found');
  ctx.db.run('DELETE FROM reviews WHERE id = ?', r.id);
  refreshRating(ctx.db, r.product_id);
  bumpCatalog(ctx.db);
  return { ok: true };
}

// ---------------- back-in-stock requests ----------------
export async function stockAlerts(ctx) {
  const items = ctx.db.all(
    `SELECT a.*, p.name_en, p.name_ar, p.slug, p.images, v.color_en, v.opt, v.stock AS variant_stock,
       (SELECT IFNULL(SUM(stock), 0) FROM variants WHERE product_id = a.product_id) AS product_stock
     FROM stock_alerts a JOIN products p ON p.id = a.product_id LEFT JOIN variants v ON v.id = a.variant_id
     ORDER BY a.notified_at IS NOT NULL, a.id DESC LIMIT 300`,
  );
  return {
    items: items.map((a) => ({
      ...a,
      image: parseJson(a.images, [])[0]?.url || '',
      images: undefined,
      variant: [a.color_en, a.opt].filter(Boolean).join(' · '),
      back_in_stock: a.variant_id ? (a.variant_stock || 0) > 0 : a.product_stock > 0,
    })),
  };
}

export async function patchStockAlert(ctx) {
  ctx.db.run('UPDATE stock_alerts SET notified_at = ? WHERE id = ?', ctx.body?.notified === false ? null : isoNow(), int(ctx.params.id, 0));
  return stockAlerts(ctx);
}

export async function deleteStockAlert(ctx) {
  ctx.db.run('DELETE FROM stock_alerts WHERE id = ?', int(ctx.params.id, 0));
  return stockAlerts(ctx);
}

// ---------------- trade-in requests ----------------
const TRADEIN_STATUSES = ['new', 'contacted', 'done', 'rejected'];

export async function tradeins(ctx) {
  const status = TRADEIN_STATUSES.includes(ctx.query.status) ? ctx.query.status : null;
  const items = status
    ? ctx.db.all('SELECT * FROM tradeins WHERE status = ? ORDER BY id DESC LIMIT 300', status)
    : ctx.db.all('SELECT * FROM tradeins ORDER BY id DESC LIMIT 300');
  const counts = {};
  for (const r of ctx.db.all('SELECT status, COUNT(*) AS n FROM tradeins GROUP BY status')) counts[r.status] = r.n;
  return { items, counts };
}

export async function patchTradein(ctx) {
  const id = int(ctx.params.id, 0);
  const t = ctx.db.get('SELECT * FROM tradeins WHERE id = ?', id);
  if (!t) throw notFound('tradein_not_found', 'Request not found');
  const status = TRADEIN_STATUSES.includes(ctx.body?.status) ? ctx.body.status : t.status;
  const offer = ctx.body?.offer === undefined ? t.offer : ctx.body.offer === '' || ctx.body.offer === null ? null : num(ctx.body.offer, null, 0, 1e6);
  const notes = ctx.body?.notes === undefined ? t.notes : optStr(ctx.body.notes, 500);
  ctx.db.run('UPDATE tradeins SET status = ?, offer = ?, notes = ?, updated_at = ? WHERE id = ?', status, offer, notes, isoNow(), id);
  return tradeins({ ...ctx, query: {} });
}

export async function deleteTradein(ctx) {
  ctx.db.run('DELETE FROM tradeins WHERE id = ?', int(ctx.params.id, 0));
  return tradeins({ ...ctx, query: {} });
}

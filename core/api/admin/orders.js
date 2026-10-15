// Admin: orders list, details, status updates and CSV export.
import { orderFull, updateOrder, ORDER_STATUSES } from '../../orders.js';
import { escapeLike, int, normalizePhone } from '../../util.js';

function filters(ctx) {
  const q = String(ctx.query.q || '').trim();
  const where = [];
  const args = [];
  if (ORDER_STATUSES.includes(ctx.query.status)) {
    where.push('o.status = ?');
    args.push(ctx.query.status);
  } else if (ctx.query.status === 'open') {
    where.push("o.status IN ('pending', 'confirmed', 'shipped', 'ready')");
  }
  if (['cod', 'whish', 'omt', 'store'].includes(ctx.query.payment)) {
    where.push('o.payment_method = ?');
    args.push(ctx.query.payment);
  }
  if (ctx.query.unpaid === '1') where.push("o.payment_status = 'unpaid' AND o.status != 'cancelled'");
  if (ctx.query.from) {
    where.push('o.created_at >= ?');
    args.push(String(ctx.query.from));
  }
  if (ctx.query.to) {
    where.push('o.created_at <= ?');
    args.push(String(ctx.query.to));
  }
  if (q) {
    const phone = normalizePhone(q);
    const like = `%${escapeLike(q)}%`;
    where.push("(o.number = ? OR o.customer_name LIKE ? ESCAPE '\\' OR o.customer_phone LIKE ? ESCAPE '\\' OR o.customer_phone = ? OR o.city LIKE ? ESCAPE '\\')");
    args.push(q.replace(/^#/, ''), like, like, phone || '', like);
  }
  if (ctx.query.customer) {
    where.push('o.customer_id = ?');
    args.push(int(ctx.query.customer, 0));
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', args };
}

export async function list(ctx) {
  const page = int(ctx.query.page, 1, 1, 10000);
  const limit = int(ctx.query.limit, 25, 5, 100);
  const { sql, args } = filters(ctx);
  const total = ctx.db.get(`SELECT COUNT(*) AS n FROM orders o ${sql}`, ...args).n;
  const items = ctx.db.all(
    `SELECT o.id, o.number, o.status, o.payment_method, o.payment_status, o.delivery_method, o.total, o.customer_name,
            o.customer_phone, o.zone, o.city, o.created_at, o.customer_id,
            (SELECT SUM(qty) FROM order_items WHERE order_id = o.id) AS items
     FROM orders o ${sql} ORDER BY o.id DESC LIMIT ? OFFSET ?`,
    ...args,
    limit,
    (page - 1) * limit,
  );
  const thumbs = (id) => ctx.db.all('SELECT image FROM order_items WHERE order_id = ? ORDER BY id LIMIT 3', id).map((r) => r.image);
  const counts = {};
  for (const r of ctx.db.all('SELECT status, COUNT(*) AS n FROM orders GROUP BY status')) counts[r.status] = r.n;
  counts.all = Object.values(counts).reduce((a, b) => a + b, 0);
  counts.open = (counts.pending || 0) + (counts.confirmed || 0) + (counts.shipped || 0) + (counts.ready || 0);
  return { items: items.map((o) => ({ ...o, images: thumbs(o.id) })), total, page, pages: Math.max(1, Math.ceil(total / limit)), counts };
}

export async function get(ctx) {
  return { order: orderFull(ctx.db, int(ctx.params.id, 0), ctx.settings(), { admin: true }) };
}

export async function patch(ctx) {
  const order = updateOrder(ctx.db, ctx.settings(), int(ctx.params.id, 0), ctx.body || {}, ctx.admin.name);
  return { order };
}

const csvCell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // avoid spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function exportCsv(ctx) {
  const { sql, args } = filters(ctx);
  const rows = ctx.db.all(`SELECT o.* FROM orders o ${sql} ORDER BY o.id DESC LIMIT 5000`, ...args);
  const header = ['number', 'date', 'status', 'payment', 'payment_status', 'customer', 'phone', 'email', 'delivery', 'zone', 'city', 'street', 'building', 'floor', 'items', 'subtotal', 'discount', 'delivery_fee', 'total', 'coupon', 'notes'];
  const lines = [header.join(',')];
  for (const o of rows) {
    const items = ctx.db
      .all('SELECT name_en, variant_en, qty FROM order_items WHERE order_id = ?', o.id)
      .map((i) => `${i.qty}x ${i.name_en}${i.variant_en ? ` (${i.variant_en})` : ''}`)
      .join(' | ');
    lines.push(
      [o.number, o.created_at, o.status, o.payment_method, o.payment_status, o.customer_name, o.customer_phone, o.customer_email, o.delivery_method, o.zone, o.city, o.street, o.building, o.floor, items, o.subtotal, o.discount, o.delivery_fee, o.total, o.coupon_code, o.notes]
        .map(csvCell)
        .join(','),
    );
  }
  return { $raw: { type: 'text/csv; charset=utf-8', body: '﻿' + lines.join('\n'), filename: `orders-${new Date().toISOString().slice(0, 10)}.csv` } };
}

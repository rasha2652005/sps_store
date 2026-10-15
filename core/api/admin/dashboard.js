// Admin dashboard numbers + the "pulse" endpoint the admin polls for new orders.
import { int, isoNow, round2 } from '../../util.js';
import { parseJson } from '../../util.js';

const TZ = 'Asia/Beirut';
let dayFmt;
function dayKey(iso) {
  dayFmt ||= new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  return dayFmt.format(new Date(iso));
}

const pct = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 1000) / 10 : cur ? 100 : 0);

export async function dashboard(ctx) {
  const db = ctx.db;
  const days = [7, 30, 90].includes(int(ctx.query.days, 30)) ? int(ctx.query.days, 30) : 30;
  const now = Date.now();
  const start = new Date(now - days * 86400000).toISOString();
  const prevStart = new Date(now - 2 * days * 86400000).toISOString();
  const settings = ctx.settings();

  const rows = db.all("SELECT id, total, status, payment_method, zone, created_at FROM orders WHERE created_at >= ? ORDER BY created_at", prevStart);
  const cur = rows.filter((r) => r.created_at >= start);
  const prev = rows.filter((r) => r.created_at < start);
  const valid = (list) => list.filter((r) => r.status !== 'cancelled');
  const sum = (list) => round2(list.reduce((s, r) => s + r.total, 0));
  const revenue = sum(valid(cur));
  const prevRevenue = sum(valid(prev));
  const orders = valid(cur).length;
  const prevOrders = valid(prev).length;
  const aov = orders ? round2(revenue / orders) : 0;
  const prevAov = prevOrders ? round2(prevRevenue / prevOrders) : 0;
  const newCustomers = db.get('SELECT COUNT(*) AS n FROM customers WHERE created_at >= ?', start).n;
  const prevCustomers = db.get('SELECT COUNT(*) AS n FROM customers WHERE created_at >= ? AND created_at < ?', prevStart, start).n;

  // Daily series in the shop's timezone.
  const series = [];
  const byDay = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const k = dayKey(new Date(now - i * 86400000).toISOString());
    if (!byDay.has(k)) {
      const o = { date: k, revenue: 0, orders: 0 };
      byDay.set(k, o);
      series.push(o);
    }
  }
  for (const r of valid(cur)) {
    const o = byDay.get(dayKey(r.created_at));
    if (o) {
      o.revenue = round2(o.revenue + r.total);
      o.orders++;
    }
  }
  const todayKey = dayKey(new Date(now).toISOString());
  const today = byDay.get(todayKey) || { revenue: 0, orders: 0 };

  const statuses = {};
  for (const r of cur) statuses[r.status] = (statuses[r.status] || 0) + 1;
  const payments = {};
  for (const r of valid(cur)) {
    payments[r.payment_method] ||= { count: 0, revenue: 0 };
    payments[r.payment_method].count++;
    payments[r.payment_method].revenue = round2(payments[r.payment_method].revenue + r.total);
  }
  const zoneMap = new Map();
  for (const r of valid(cur)) {
    const k = r.zone || 'pickup';
    const z = zoneMap.get(k) || { zone: k, count: 0, revenue: 0 };
    z.count++;
    z.revenue = round2(z.revenue + r.total);
    zoneMap.set(k, z);
  }
  const zoneNames = new Map((settings.delivery.zones || []).map((z) => [z.id, { en: z.en, ar: z.ar }]));
  const zones = [...zoneMap.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)
    .map((z) => ({ ...z, name: zoneNames.get(z.zone) || (z.zone === 'pickup' ? { en: 'Store pickup', ar: 'استلام من المحل' } : { en: z.zone, ar: z.zone }) }));

  const top = db.all(
    `SELECT i.product_id, MAX(i.name_en) AS name_en, MAX(i.name_ar) AS name_ar, MAX(i.image) AS image,
            SUM(i.qty) AS qty, SUM(i.qty * i.unit_price) AS revenue
     FROM order_items i JOIN orders o ON o.id = i.order_id
     WHERE o.created_at >= ? AND o.status != 'cancelled'
     GROUP BY i.product_id ORDER BY revenue DESC LIMIT 6`,
    start,
  );
  const low = db.all(
    `SELECT v.id AS variant_id, v.product_id, v.stock, v.color_en, v.opt, p.name_en, p.name_ar, p.images
     FROM variants v JOIN products p ON p.id = v.product_id
     WHERE p.active = 1 AND v.stock <= 3 ORDER BY v.stock, p.sold_count DESC LIMIT 8`,
  );
  const recent = db.all(
    `SELECT o.id, o.number, o.customer_name, o.total, o.status, o.payment_method, o.created_at,
       (SELECT SUM(qty) FROM order_items WHERE order_id = o.id) AS items
     FROM orders o ORDER BY o.id DESC LIMIT 8`,
  );
  const topSearches = db.all('SELECT q, COUNT(*) AS n, MAX(results) AS results FROM search_log WHERE created_at >= ? GROUP BY q ORDER BY n DESC LIMIT 8', start);
  const zeroSearches = db.all('SELECT q, COUNT(*) AS n FROM search_log WHERE created_at >= ? AND results = 0 GROUP BY q ORDER BY n DESC LIMIT 8', start);

  return {
    days,
    kpis: {
      revenue: { value: revenue, prev: prevRevenue, change: pct(revenue, prevRevenue) },
      orders: { value: orders, prev: prevOrders, change: pct(orders, prevOrders) },
      aov: { value: aov, prev: prevAov, change: pct(aov, prevAov) },
      customers: { value: newCustomers, prev: prevCustomers, change: pct(newCustomers, prevCustomers) },
      today: { revenue: today.revenue, orders: today.orders },
      pending: db.get("SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'").n,
      to_deliver: db.get("SELECT COUNT(*) AS n FROM orders WHERE status IN ('confirmed', 'shipped', 'ready')").n,
      unpaid_transfers: db.get("SELECT COUNT(*) AS n FROM orders WHERE payment_method IN ('whish', 'omt') AND payment_status = 'unpaid' AND status != 'cancelled'").n,
    },
    series,
    statuses,
    payments,
    zones,
    top_products: top.map((t) => ({ ...t, revenue: round2(t.revenue), name: { en: t.name_en, ar: t.name_ar || t.name_en } })),
    low_stock: low.map((l) => {
      const imgs = parseJson(l.images, []);
      const img = imgs.find((i) => i.color && i.color === l.color_en) || imgs[0];
      return {
        product_id: l.product_id,
        variant_id: l.variant_id,
        stock: l.stock,
        name: { en: l.name_en, ar: l.name_ar || l.name_en },
        variant: [l.color_en, l.opt].filter(Boolean).join(' · '),
        image: img?.url || '',
      };
    }),
    recent,
    searches: { top: topSearches, zero: zeroSearches },
    alerts_waiting: db.get('SELECT COUNT(*) AS n FROM stock_alerts WHERE notified_at IS NULL').n,
    tradeins_new: db.get("SELECT COUNT(*) AS n FROM tradeins WHERE status = 'new'").n,
  };
}

export async function pulse(ctx) {
  const since = String(ctx.query.since || '');
  const fresh = since
    ? ctx.db.all('SELECT id, number, customer_name, total, created_at FROM orders WHERE created_at > ? ORDER BY id DESC LIMIT 5', since)
    : [];
  return {
    server_time: isoNow(),
    pending: ctx.db.get("SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'").n,
    tradeins_new: ctx.db.get("SELECT COUNT(*) AS n FROM tradeins WHERE status = 'new'").n,
    alerts_waiting: ctx.db.get('SELECT COUNT(*) AS n FROM stock_alerts WHERE notified_at IS NULL').n,
    new_orders: fresh,
  };
}

// Public storefront endpoints.
import { bad, notFound } from '../errors.js';
import { cardOf, getCatalog, listProducts, productDetail, refreshRating } from '../catalog.js';
import { search } from '../search.js';
import { quote } from '../pricing.js';
import { cancelByCustomer, orderFull, placeOrder } from '../orders.js';
import { publicSettings } from '../settings.js';
import { rateLimit } from '../auth.js';
import { bumpCatalog } from '../schema.js';
import { int, isEmail, isoNow, normalizePhone, optStr, str } from '../util.js';
import { normalize } from '../search.js';

export async function bootstrap(ctx) {
  const cat = getCatalog(ctx.db);
  return {
    settings: publicSettings(ctx.settings()),
    categories: cat.categories,
    brands: cat.brands.filter((b) => b.count > 0),
    devices: cat.devices,
    demo: !!ctx.env.demo,
  };
}

export async function home(ctx) {
  const cat = getCatalog(ctx.db);
  const s = ctx.settings();
  const products = cat.products;
  const hero = (s.home.hero || []).map((h) => {
    const p = h.product_slug ? cat.bySlug.get(h.product_slug) : null;
    return { ...h, product: p ? cardOf(p) : null };
  });
  const byNewest = [...products].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const deals = products
    .filter((p) => p.discount_pct > 0 && p.in_stock)
    .sort((a, b) => b.discount_pct - a.discount_pct)
    .slice(0, 12);
  const dealEnds = deals
    .map((p) => p.deal_ends_at)
    .filter(Boolean)
    .sort()[0] || null;
  const best = [...products]
    .filter((p) => p.in_stock)
    .sort((a, b) => b.sold_count - a.sold_count || Number(b.featured) - Number(a.featured))
    .slice(0, 8);
  const phones = byNewest.filter((p) => p.category?.kind === 'phone' && p.in_stock).slice(0, 12);
  const accessories = [...products]
    .filter((p) => p.category?.kind === 'accessory' && p.in_stock)
    .sort((a, b) => Number(b.featured) - Number(a.featured) || b.sold_count - a.sold_count)
    .slice(0, 12);
  const used = products.filter((p) => p.condition !== 'new' && p.in_stock).slice(0, 8);
  const categoryImages = {};
  for (const c of cat.categories) {
    const best = products
      .filter((p) => p.category?.id === c.id && p.images.length)
      .sort((a, b) => Number(b.in_stock) - Number(a.in_stock) || Number(b.featured) - Number(a.featured) || b.sold_count - a.sold_count)[0];
    if (best) categoryImages[c.slug] = best.images[0].url;
  }
  return {
    category_images: categoryImages,
    hero,
    deals: deals.map(cardOf),
    deals_end: dealEnds,
    new_arrivals: byNewest.filter((p) => p.in_stock).slice(0, 12).map(cardOf),
    bestsellers: best.map(cardOf),
    phones: phones.map(cardOf),
    accessories: accessories.map(cardOf),
    used: used.map(cardOf),
  };
}

export async function products(ctx) {
  const out = listProducts(ctx.db, ctx.query);
  const q = String(ctx.query.q || '').trim();
  if (q && String(ctx.query.page || '1') === '1' && ctx.query.log === '1') {
    ctx.db.run('INSERT INTO search_log (q, results, created_at) VALUES (?, ?, ?)', q.slice(0, 80).toLowerCase(), out.total, isoNow());
  }
  return out;
}

export async function product(ctx) {
  const d = productDetail(ctx.db, ctx.params.slug);
  if (!d) throw notFound('product_not_found', 'Product not found');
  return d;
}

export async function suggest(ctx) {
  const q = String(ctx.query.q || '').trim().slice(0, 80);
  if (!q) return { products: [], categories: [], brands: [], correction: null, total: 0 };
  const cat = getCatalog(ctx.db);
  const r = search(cat.index, q, { limit: 50 });
  const nq = normalize(q);
  const matchName = (n) => {
    const a = normalize(n.en || n);
    const b = normalize(n.ar || '');
    return a.includes(nq) || (b && b.includes(nq)) || nq.includes(a);
  };
  return {
    products: r.results.slice(0, 7).map(({ p }) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand?.name || '',
      category: p.category?.name || null,
      image: p.images[0]?.url || '',
      price_min: p.price_min,
      price_max: p.price_max,
      compare_at: p.compare_at,
      in_stock: p.in_stock,
      condition: p.condition,
    })),
    categories: cat.categories.filter((c) => c.count && nq.length >= 2 && matchName(c.name)).slice(0, 3),
    brands: cat.brands.filter((b) => b.count && nq.length >= 2 && matchName(b.name)).slice(0, 3),
    correction: r.results.length ? null : r.correction,
    total: r.results.length,
  };
}

export async function cartQuote(ctx) {
  return quote(ctx.db, ctx.settings(), ctx.body || {}, { customerId: ctx.customer?.id || null, lang: ctx.body?.lang });
}

export async function createOrder(ctx) {
  rateLimit(`order:${ctx.ip}`, 12, 10 * 60 * 1000);
  const order = placeOrder(ctx.db, ctx.settings(), ctx.body || {}, { customer: ctx.customer, isDemo: !!ctx.env.demo });
  ctx.emit?.('order', { number: order.number });
  return { order };
}

export async function getOrder(ctx) {
  const o = ctx.db.get('SELECT id, access_key, customer_id FROM orders WHERE number = ?', String(ctx.params.number));
  const key = String(ctx.query.key || '');
  const owner = o && ctx.customer && o.customer_id === ctx.customer.id;
  if (!o || (!owner && (!key || key !== o.access_key))) throw notFound('order_not_found', 'Order not found');
  const order = orderFull(ctx.db, o.id, ctx.settings());
  return { order: { ...order, key: o.access_key } };
}

export async function trackOrder(ctx) {
  rateLimit(`track:${ctx.ip}`, 15, 10 * 60 * 1000);
  const number = str(ctx.body?.number, 20).replace(/^#/, '');
  const phone = normalizePhone(ctx.body?.phone);
  const o = ctx.db.get('SELECT number, access_key, customer_phone FROM orders WHERE number = ?', number);
  if (!o || !phone || o.customer_phone !== phone) throw notFound('order_not_found', 'No order matches this number and phone');
  return { number: o.number, key: o.access_key };
}

export async function cancelOrder(ctx) {
  const order = cancelByCustomer(ctx.db, ctx.settings(), ctx.params.number, ctx.body?.key);
  return { order };
}

export async function stockAlert(ctx) {
  rateLimit(`alert:${ctx.ip}`, 20, 10 * 60 * 1000);
  const productId = int(ctx.body?.product_id, 0);
  const p = ctx.db.get('SELECT id FROM products WHERE id = ?', productId);
  if (!p) throw notFound('product_not_found', 'Product not found');
  const raw = str(ctx.body?.contact, 120);
  const contact = normalizePhone(raw) || (isEmail(raw) ? raw.toLowerCase() : null);
  if (!contact) throw bad('contact_invalid', 'Enter a phone number or email', { field: 'contact' });
  const variantId = int(ctx.body?.variant_id, 0) || null;
  const dup = ctx.db.get(
    'SELECT id FROM stock_alerts WHERE product_id = ? AND IFNULL(variant_id, 0) = ? AND contact = ? AND notified_at IS NULL',
    productId,
    variantId || 0,
    contact,
  );
  if (!dup) {
    ctx.db.run('INSERT INTO stock_alerts (product_id, variant_id, contact, created_at) VALUES (?, ?, ?, ?)', productId, variantId, contact, isoNow());
  }
  return { ok: true };
}

export async function tradeIn(ctx) {
  rateLimit(`tradein:${ctx.ip}`, 8, 30 * 60 * 1000);
  const b = ctx.body || {};
  const name = str(b.name, 80);
  if (name.length < 2) throw bad('name_required', 'Please enter your name', { field: 'name' });
  const phone = normalizePhone(b.phone);
  if (!phone) throw bad('phone_invalid', 'Please enter a valid phone number', { field: 'phone' });
  const device = str(b.device, 80);
  if (device.length < 2) throw bad('device_required', 'Which phone do you have?', { field: 'device' });
  const condition = ['like_new', 'good', 'fair', 'broken'].includes(b.condition) ? b.condition : 'good';
  const battery = b.battery === '' || b.battery == null ? null : int(b.battery, null, 0, 100);
  const now = isoNow();
  ctx.db.run(
    'INSERT INTO tradeins (name, phone, device, storage, condition, battery, wants, notes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    name,
    phone,
    device,
    optStr(b.storage, 20),
    condition,
    battery,
    optStr(b.wants, 120),
    optStr(b.notes, 500),
    'new',
    now,
    now,
  );
  ctx.emit?.('tradein', {});
  return { ok: true };
}

export async function reviews(ctx) {
  const p = ctx.db.get('SELECT id FROM products WHERE slug = ?', ctx.params.slug);
  if (!p) throw notFound('product_not_found', 'Product not found');
  const page = int(ctx.query.page, 1, 1, 100);
  const rows = ctx.db.all(
    'SELECT id, author, rating, comment, verified, created_at FROM reviews WHERE product_id = ? AND hidden = 0 ORDER BY created_at DESC LIMIT 10 OFFSET ?',
    p.id,
    (page - 1) * 10,
  );
  const total = ctx.db.get('SELECT COUNT(*) AS n FROM reviews WHERE product_id = ? AND hidden = 0', p.id).n;
  let mine = null;
  let canReview = false;
  if (ctx.customer) {
    mine = ctx.db.get('SELECT id, rating, comment FROM reviews WHERE product_id = ? AND customer_id = ?', p.id, ctx.customer.id) || null;
    canReview = true;
  }
  return { items: rows.map((r) => ({ ...r, verified: !!r.verified })), total, page, pages: Math.max(1, Math.ceil(total / 10)), mine, can_review: canReview };
}

export async function addReview(ctx) {
  const p = ctx.db.get('SELECT id FROM products WHERE slug = ?', ctx.params.slug);
  if (!p) throw notFound('product_not_found', 'Product not found');
  const rating = int(ctx.body?.rating, 0, 0, 5);
  if (rating < 1) throw bad('rating_required', 'Please choose a rating', { field: 'rating' });
  const comment = optStr(ctx.body?.comment, 1000);
  const c = ctx.customer;
  const verified = ctx.db.get(
    "SELECT 1 AS ok FROM orders o JOIN order_items i ON i.order_id = o.id WHERE o.customer_id = ? AND i.product_id = ? AND o.status = 'delivered' LIMIT 1",
    c.id,
    p.id,
  );
  const author = c.name.split(' ')[0] + (c.name.split(' ')[1] ? ` ${c.name.split(' ')[1][0]}.` : '');
  ctx.db.run(
    `INSERT INTO reviews (product_id, customer_id, author, rating, comment, verified, hidden, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT(product_id, customer_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment, verified = excluded.verified, created_at = excluded.created_at`,
    p.id,
    c.id,
    author,
    rating,
    comment,
    verified ? 1 : 0,
    isoNow(),
  );
  refreshRating(ctx.db, p.id);
  bumpCatalog(ctx.db);
  return { ok: true };
}

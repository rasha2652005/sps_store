// API tests: run with `npm test`. Uses an in-memory database, so nothing on disk is touched.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { migrate } from '../core/schema.js';
import { seedDemo } from '../core/seed/index.js';
import { dispatch } from '../core/dispatch.js';
import { AUTH } from '../core/auth.js';

AUTH.iterations = 2000; // keep tests fast

let db;
const storage = { saveImage: async () => '/uploads/test.webp' };

function client() {
  const jar = {};
  const call = async (method, path, body, query = {}) => {
    const [p, qs] = path.split('?');
    const q = { ...Object.fromEntries(new URLSearchParams(qs || '')), ...query };
    const out = await dispatch({ method, path: p, query: q, body, cookies: { ...jar }, ip: '127.0.0.1' }, { db, storage, log: (e) => console.error(e) });
    for (const c of out.cookies) {
      if (c.maxAge > 0) jar[c.name] = c.value;
      else delete jar[c.name];
    }
    return { status: out.status, ...(out.json || {}), raw: out.raw };
  };
  return {
    get: (p, q) => call('GET', p, undefined, q),
    post: (p, b) => call('POST', p, b),
    put: (p, b) => call('PUT', p, b),
    patch: (p, b) => call('PATCH', p, b),
    del: (p) => call('DELETE', p),
    jar,
  };
}

const shopper = () => ({ name: 'Rami Test', phone: '81 078 452', email: '' });
const address = { method: 'delivery', zone: 'beirut', city: 'Hamra', street: 'Bliss Street', building: 'Cedar', floor: '3' };

before(() => {
  db = openDb(':memory:');
  migrate(db);
  seedDemo(db, { saveSvg: (name) => `/uploads/seed/${name}` });
});

test('bootstrap returns settings, categories and devices', async () => {
  const c = client();
  const r = await c.get('/api/bootstrap');
  assert.equal(r.status, 200);
  assert.equal(r.settings.store.short_name, 'SPS');
  assert.ok(r.categories.length >= 8);
  assert.ok(r.devices.some((d) => d.name === 'iPhone 17 Pro'));
  assert.equal(r.settings.payments.whish.account_number, '81 078 452');
});

test('listing, filters and facets', async () => {
  const c = client();
  const all = await c.get('/api/products?limit=60');
  assert.ok(all.total >= 40, `total ${all.total}`);
  const phones = await c.get('/api/products?category=phones');
  assert.ok(phones.items.every((p) => p.category.slug === 'phones'));
  assert.ok(phones.facets.brands.find((b) => b.slug === 'apple'));
  const apple = await c.get('/api/products?category=phones&brand=apple&sort=price_asc');
  const prices = apple.items.map((p) => p.price_min);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
  const used = await c.get('/api/products?condition=used');
  assert.ok(used.items.length >= 1 && used.items.every((p) => p.condition === 'used'));
  const deals = await c.get('/api/products?deals=1');
  assert.ok(deals.items.every((p) => p.discount_pct > 0));
  const fits = await c.get('/api/products?fits=iPhone 17 Pro&category=cases');
  assert.ok(fits.items.length >= 2);
});

test('smart search: Arabic, typos, models', async () => {
  const c = client();
  const s1 = await c.get('/api/products', { q: 'ايفون 17 برو' });
  assert.equal(s1.items[0].slug, 'iphone-17-pro');
  const s2 = await c.get('/api/products', { q: 'samsng s25 ultra' });
  assert.equal(s2.items[0].slug, 'galaxy-s25-ultra');
  const s3 = await c.get('/api/products', { q: 'كفر' });
  assert.ok(s3.items.length >= 3 && s3.items.every((p) => p.category.slug === 'cases'), s3.items.map((p) => p.slug).join(','));
  const s4 = await c.get('/api/products', { q: 'chrger' });
  assert.ok(s4.items.some((p) => p.category.slug === 'chargers'));
  const s5 = await c.get('/api/products', { q: 'iphone 17' });
  assert.equal(s5.items[0].slug, 'iphone-17');
  const s6 = await c.get('/api/products', { q: 'شريط شحن' });
  assert.ok(s6.items.some((p) => p.category.slug === 'cables'));
  const sug = await c.get('/api/search/suggest', { q: 'airpods' });
  assert.ok(sug.products[0].name.en.startsWith('AirPods'));
  const none = await c.get('/api/products', { q: 'zzzzqqq' });
  assert.equal(none.total, 0);
});

test('product page has accessories that fit it', async () => {
  const c = client();
  const r = await c.get('/api/products/iphone-17-pro');
  assert.equal(r.status, 200);
  assert.equal(r.product.opts.join(','), '256GB,512GB,1TB');
  assert.ok(r.accessories.some((a) => a.slug === 'clear-magnetic-case'));
  assert.ok(r.related.length > 0);
  const missing = await c.get('/api/products/nope');
  assert.equal(missing.status, 404);
});

function variantOf(slug, i = 0) {
  return db.get('SELECT v.* FROM variants v JOIN products p ON p.id = v.product_id WHERE p.slug = ? ORDER BY v.sort LIMIT 1 OFFSET ?', slug, i);
}

test('cart quote: prices, delivery and free delivery', async () => {
  const c = client();
  const cable = variantOf('braided-usb-c-to-usb-c-cable-60w');
  const q1 = await c.post('/api/cart/quote', { items: [{ variant_id: cable.id, qty: 2 }], zone: 'north' });
  assert.equal(q1.subtotal, cable.price * 2);
  assert.equal(q1.delivery_fee, 5);
  assert.equal(q1.total, cable.price * 2 + 5);
  const phone = variantOf('iphone-17');
  const q2 = await c.post('/api/cart/quote', { items: [{ variant_id: phone.id, qty: 1 }], zone: 'north' });
  assert.equal(q2.delivery_fee, 0);
  assert.equal(q2.free_delivery, true);
  const q3 = await c.post('/api/cart/quote', { items: [{ variant_id: cable.id, qty: 1 }], coupon: 'NOPE' });
  assert.equal(q3.coupon.valid, false);
});

test('checkout, order page, tracking and stock', async () => {
  const c = client();
  const v = variantOf('gan-65w-3-port-charger');
  const before = v.stock;
  const r = await c.post('/api/orders', { items: [{ variant_id: v.id, qty: 2 }], customer: shopper(), delivery: address, payment_method: 'cod', lang: 'en' });
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.equal(r.order.status, 'pending');
  assert.equal(r.order.customer.phone, '+96181078452');
  assert.equal(r.order.total, v.price * 2 + 3);
  assert.equal(db.get('SELECT stock FROM variants WHERE id = ?', v.id).stock, before - 2);

  const view = await c.get(`/api/orders/${r.order.number}`, { key: r.order.key });
  assert.equal(view.status, 200);
  const wrong = await c.get(`/api/orders/${r.order.number}`, { key: 'bad' });
  assert.equal(wrong.status, 404);
  const tr = await c.post('/api/orders/track', { number: `#${r.order.number}`, phone: '+961 81 078 452' });
  assert.equal(tr.key, r.order.key);
  const tr2 = await c.post('/api/orders/track', { number: r.order.number, phone: '70 111 222' });
  assert.equal(tr2.status, 404);

  const cancel = await c.post(`/api/orders/${r.order.number}/cancel`, { key: r.order.key });
  assert.equal(cancel.order.status, 'cancelled');
  assert.equal(db.get('SELECT stock FROM variants WHERE id = ?', v.id).stock, before);
});

test('checkout validation and stock conflicts', async () => {
  const c = client();
  const v = variantOf('iphone-17-pro-max');
  const bad = await c.post('/api/orders', { items: [{ variant_id: v.id, qty: 1 }], customer: { ...shopper(), phone: '123' }, delivery: address, payment_method: 'cod' });
  assert.equal(bad.status, 400);
  assert.equal(bad.error.code, 'phone_invalid');
  const noZone = await c.post('/api/orders', { items: [{ variant_id: v.id, qty: 1 }], customer: shopper(), delivery: { ...address, zone: 'mars' }, payment_method: 'cod' });
  assert.equal(noZone.error.code, 'zone_required');
  const pickupCod = await c.post('/api/orders', { items: [{ variant_id: v.id, qty: 1 }], customer: shopper(), delivery: { method: 'pickup' }, payment_method: 'cod' });
  assert.equal(pickupCod.error.code, 'payment_invalid');
  const tooMany = await c.post('/api/orders', { items: [{ variant_id: v.id, qty: v.stock + 1 }], customer: shopper(), delivery: address, payment_method: 'cod' });
  assert.equal(tooMany.status, 409);
  assert.equal(tooMany.error.code, 'cart_changed');
  const pickup = await c.post('/api/orders', { items: [{ variant_id: v.id, qty: 1 }], customer: shopper(), delivery: { method: 'pickup' }, payment_method: 'store' });
  assert.equal(pickup.status, 200);
  assert.equal(pickup.order.delivery_fee, 0);
  assert.equal(pickup.order.address, null);
});

test('customer account: register, login, wishlist, orders', async () => {
  const c = client();
  const reg = await c.post('/api/auth/register', { name: 'Maya Test', phone: '03 123 456', password: 'short' });
  assert.equal(reg.error.code, 'password_too_short');
  const ok = await c.post('/api/auth/register', { name: 'Maya Test', phone: '03 123 456', email: 'maya@example.com', password: 'longenough1' });
  assert.equal(ok.status, 200);
  assert.equal(ok.customer.phone, '+9613123456');
  const dup = await client().post('/api/auth/register', { name: 'Xavier', phone: '+961 3 123456', password: 'longenough1' });
  assert.equal(dup.error.code, 'phone_taken');
  const p = db.get("SELECT id FROM products WHERE slug = 'airpods-pro-3'");
  const w = await c.post('/api/account/wishlist', { product_id: p.id, on: true });
  assert.deepEqual(w.wishlist, [p.id]);
  const v = variantOf('airpods-pro-3');
  const order = await c.post('/api/orders', { items: [{ variant_id: v.id, qty: 1 }], customer: { name: 'Maya Test', phone: '03123456' }, delivery: address, payment_method: 'whish', save_address: true });
  assert.equal(order.status, 200);
  const mine = await c.get('/api/account/orders');
  assert.equal(mine.items.length, 1);
  const me = await c.get('/api/auth/me');
  assert.equal(me.addresses.length, 1);
  await c.post('/api/auth/logout', {});
  const anon = await c.get('/api/account/orders');
  assert.equal(anon.status, 401);
  const c2 = client();
  const wrong = await c2.post('/api/auth/login', { login: 'maya@example.com', password: 'nope-nope' });
  assert.equal(wrong.status, 401);
  const good = await c2.post('/api/auth/login', { login: '03 123 456', password: 'longenough1' });
  assert.equal(good.customer.name, 'Maya Test');
});

test('admin: setup, dashboard, orders, products, settings', async () => {
  const a = client();
  assert.equal((await a.get('/api/admin/setup')).needs_setup, true);
  const anon = await a.get('/api/admin/dashboard');
  assert.equal(anon.status, 401);
  const setup = await a.post('/api/admin/setup', { name: 'Owner', email: 'owner@sps.test', password: 'supersecret1' });
  assert.equal(setup.admin.role, 'owner');
  const again = await client().post('/api/admin/setup', { name: 'Evil', email: 'evil@x.test', password: 'supersecret1' });
  assert.equal(again.status, 403);

  const dash = await a.get('/api/admin/dashboard', { days: '30' });
  assert.equal(dash.status, 200);
  assert.ok(dash.kpis.orders.value >= 2);
  assert.equal(dash.series.length, 30);

  const list = await a.get('/api/admin/orders', { status: 'pending' });
  assert.ok(list.items.length >= 1);
  const id = list.items[0].id;
  const conf = await a.patch(`/api/admin/orders/${id}`, { status: 'confirmed', note: 'Called the customer' });
  assert.equal(conf.order.status, 'confirmed');
  const del = await a.patch(`/api/admin/orders/${id}`, { status: 'delivered' });
  assert.equal(del.order.status, 'delivered');
  const csv = await a.get('/api/admin/orders-export');
  assert.match(csv.raw.body, /number,date,status/);

  // product CRUD
  const cats = await a.get('/api/admin/taxonomy');
  const created = await a.post('/api/admin/products', {
    name_en: 'Test Phone X',
    category_id: cats.categories[0].id,
    variants: [
      { color_en: 'Black', color_hex: '#111111', opt: '128GB', price: 300, stock: 3 },
      { color_en: 'Black', color_hex: '#111111', opt: '256GB', price: 350, compare_at: 400, stock: 0 },
    ],
    specs: [{ key: 'display', value: '6.5"' }],
    images: [{ url: '/uploads/a.webp' }, { url: 'javascript:alert(1)' }],
  });
  assert.equal(created.product.slug, 'test-phone-x');
  assert.equal(created.product.images.length, 1);
  const pub = await client().get('/api/products', { q: 'test phone x' });
  assert.equal(pub.items[0].slug, 'test-phone-x');
  const dupVar = await a.put(`/api/admin/products/${created.product.id}`, {
    name_en: 'Test Phone X',
    variants: [
      { color_en: 'Black', opt: '128GB', price: 300 },
      { color_en: 'black', opt: '128gb', price: 310 },
    ],
  });
  assert.equal(dupVar.error.code, 'duplicate_variant');
  const copy = await a.post(`/api/admin/products/${created.product.id}/duplicate`, {});
  assert.equal(copy.product.active, false);
  assert.equal((await a.del(`/api/admin/products/${copy.product.id}`)).ok, true);

  // settings
  const bad = await a.put('/api/admin/settings/payments', { cod: { enabled: false }, whish: { enabled: false }, omt: { enabled: false } });
  assert.equal(bad.error.code, 'payments_required');
  const ok = await a.put('/api/admin/settings/currency', { lbp_rate: 90000, show_lbp: true });
  assert.equal(ok.settings.currency.lbp_rate, 90000);

  // staff cannot change settings
  await a.post('/api/admin/team', { name: 'Staff', email: 'staff@sps.test', password: 'supersecret2' });
  const s = client();
  await s.post('/api/admin/login', { email: 'staff@sps.test', password: 'supersecret2' });
  const denied = await s.put('/api/admin/settings/currency', { lbp_rate: 1 });
  assert.equal(denied.status, 403);
});

test('coupons apply and are counted', async () => {
  const a = client();
  await a.post('/api/admin/login', { email: 'owner@sps.test', password: 'supersecret1' });
  const r = await a.post('/api/admin/coupons', { code: 'test10', type: 'percent', value: 10, min_subtotal: 20 });
  assert.ok(r.items.find((x) => x.code === 'TEST10'));
  const c = client();
  const v = variantOf('power-bank-20-000mah-22-5w');
  const q = await c.post('/api/cart/quote', { items: [{ variant_id: v.id, qty: 1 }], coupon: 'Test10', zone: 'beirut' });
  assert.equal(q.coupon.valid, true);
  assert.equal(q.discount, Math.round(v.price * 10) / 100);
  const o = await c.post('/api/orders', { items: [{ variant_id: v.id, qty: 1 }], coupon: 'TEST10', customer: shopper(), delivery: address, payment_method: 'omt' });
  assert.equal(o.status, 200);
  assert.equal(db.get("SELECT used_count FROM coupons WHERE code = 'TEST10'").used_count, 1);
});

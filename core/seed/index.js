// Seeds the demo catalog (and, for demos only, sample orders/customers so the admin dashboard has data).
import { BRANDS, CATEGORIES, PRODUCTS } from './catalog.js';
import { renderArt } from './art.js';
import { bumpCatalog } from '../schema.js';
import { round2, slugify, tx } from '../util.js';

const iso = (ms) => new Date(ms).toISOString();

/**
 * saveSvg(name, svgString) -> url   (sync)
 * extras: also create demo customers/orders/coupons (only for the public demo and local screenshots)
 */
export function seedDemo(db, { saveSvg, extras = false, now = Date.now() } = {}) {
  if (db.get('SELECT COUNT(*) AS n FROM products').n > 0) return false;
  tx(db, () => {
    CATEGORIES.forEach((c, i) => {
      db.run(
        'INSERT INTO categories (slug, name_en, name_ar, icon, kind, sort, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        c.slug,
        c.en,
        c.ar,
        c.icon,
        c.kind,
        i + 1,
        iso(now),
      );
    });
    BRANDS.forEach((b, i) => db.run('INSERT INTO brands (slug, name, sort) VALUES (?, ?, ?)', slugify(b), b, i + 1));
    const catId = new Map(db.all('SELECT id, slug FROM categories').map((r) => [r.slug, r.id]));
    const brandId = new Map(db.all('SELECT id, name FROM brands').map((r) => [r.name, r.id]));

    PRODUCTS.forEach((p, pi) => {
      const slug = p.slug || slugify(p.name_en);
      const colors = p.colors.length ? p.colors : [null];
      const images = [];
      colors.forEach((c) => {
        const base = c ? `${slug}-${slugify(c.en)}` : slug;
        const spec = { ...p.art, color: c?.hex || p.art.color, band: c?.band };
        if (p.art.type === 'phone') {
          images.push({ url: saveSvg(`${base}-1.svg`, renderArt({ ...spec, view: 'pair' })), color: c?.en });
          images.push({ url: saveSvg(`${base}-2.svg`, renderArt({ ...spec, view: 'back' })), color: c?.en });
        } else {
          images.push({ url: saveSvg(`${base}.svg`, renderArt(spec)), color: c?.en });
        }
      });
      const created = now - (p.age || 30) * 86400000 - pi * 3600000;
      const r = db.run(
        `INSERT INTO products (slug, name_en, name_ar, subtitle_en, subtitle_ar, description_en, description_ar, category_id, brand_id, condition,
           warranty_en, warranty_ar, opt_label_en, opt_label_ar, device, images, specs, tags, fits, featured, active, deal_ends_at, sold_count, is_demo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 1, ?, ?)`,
        slug,
        p.name_en,
        p.name_ar,
        p.subtitle_en || '',
        p.subtitle_ar || '',
        p.description_en || '',
        p.description_ar || '',
        catId.get(p.category) || null,
        p.brand ? brandId.get(p.brand) : null,
        p.condition || 'new',
        p.warranty_en || '',
        p.warranty_ar || '',
        p.opt_label_en || '',
        p.opt_label_ar || '',
        p.device || '',
        JSON.stringify(images.map((i) => (i.color ? i : { url: i.url }))),
        JSON.stringify((p.specs || []).map(([key, value]) => ({ key, value }))),
        p.tags || '',
        JSON.stringify(p.fits || []),
        p.featured ? 1 : 0,
        p.deal ? iso(now + p.deal * 86400000 + 5 * 3600000) : null,
        p.sold || 0,
        iso(created),
        iso(created),
      );
      let sort = 0;
      colors.forEach((c, ci) => {
        p.opts.forEach(([opt, price, compare], oi) => {
          db.run(
            'INSERT INTO variants (product_id, sku, color_en, color_ar, color_hex, opt, price, compare_at, stock, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            r.lastInsertRowid,
            `SPS-${String(pi + 101)}-${String(sort + 1).padStart(2, '0')}`,
            c?.en || null,
            c?.ar || null,
            c?.hex || null,
            opt || null,
            price,
            compare || null,
            Math.max(0, p.stock(ci, oi) ?? 5),
            sort++,
          );
        });
      });
    });
    if (extras) seedExtras(db, now);
    bumpCatalog(db);
  });
  return true;
}

// ---------------- demo-only data ----------------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Rami', 'Maya', 'Karim', 'Nour', 'Ali', 'Lara', 'Hadi', 'Rita', 'Omar', 'Yara', 'Jad', 'Sara', 'Hassan', 'Christelle', 'Mohammad', 'Joelle', 'Elie', 'Rana', 'Ziad', 'Lea', 'Fadi', 'Hiba', 'Tony', 'Zeina'];
const LAST = ['Haddad', 'Khoury', 'Saade', 'Nasser', 'Fakhoury', 'Hamdan', 'Mansour', 'Aoun', 'Daher', 'Chami', 'Zein', 'Karam', 'Sleiman', 'Itani'];
const CITIES = {
  beirut: ['Hamra', 'Achrafieh', 'Verdun', 'Mar Mikhael', 'Badaro', 'Ras Beirut'],
  'mount-lebanon': ['Baabda', 'Aley', 'Hazmieh', 'Jdeideh', 'Dbayeh', 'Antelias'],
  'keserwan-jbeil': ['Jounieh', 'Byblos', 'Zouk Mosbeh', 'Kaslik'],
  north: ['Tripoli', 'Batroun', 'Zgharta'],
  akkar: ['Halba'],
  bekaa: ['Zahle', 'Chtaura'],
  'baalbek-hermel': ['Baalbek'],
  south: ['Saida', 'Tyre', 'Jezzine'],
  nabatieh: ['Nabatieh'],
};
const ZONE_WEIGHTS = [
  ['beirut', 34],
  ['mount-lebanon', 28],
  ['keserwan-jbeil', 10],
  ['north', 8],
  ['south', 8],
  ['bekaa', 5],
  ['nabatieh', 4],
  ['akkar', 2],
  ['baalbek-hermel', 1],
];
const FEES = { beirut: 3, 'mount-lebanon': 4, 'keserwan-jbeil': 4, north: 5, akkar: 6, bekaa: 5, 'baalbek-hermel': 6, south: 5, nabatieh: 5 };

function weighted(r, list) {
  const total = list.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [v, w] of list) {
    x -= w;
    if (x <= 0) return v;
  }
  return list[0][0];
}

/** Milliseconds since midnight in Lebanon for a timestamp (works in Node and browsers). */
function beirutMsSinceMidnight(now) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Beirut', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now));
    const get = (type) => Number(parts.find((x) => x.type === type)?.value || 0);
    return ((get('hour') * 60 + get('minute')) * 60 + get('second')) * 1000;
  } catch {
    return (now + 3 * 3600000) % 86400000;
  }
}

function seedExtras(db, now) {
  const r = rng(20261014);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const variants = db.all(
    `SELECT v.id, v.product_id, v.price, v.color_en, v.color_ar, v.opt, v.sku, p.slug, p.name_en, p.name_ar, p.images, c.kind
     FROM variants v JOIN products p ON p.id = v.product_id JOIN categories c ON c.id = p.category_id`,
  );
  const phones = variants.filter((v) => v.kind === 'phone');
  const others = variants.filter((v) => v.kind !== 'phone');

  // coupons (demo only)
  db.run("INSERT INTO coupons (code, type, value, min_subtotal, active, created_at) VALUES ('WELCOME10', 'percent', 10, 50, 1, ?)", iso(now));
  db.run("INSERT INTO coupons (code, type, value, min_subtotal, active, created_at) VALUES ('FREEDELIVERY', 'shipping', 0, 0, 1, ?)", iso(now));
  db.run("INSERT INTO coupons (code, type, value, min_subtotal, usage_limit, active, created_at) VALUES ('SPS20', 'fixed', 20, 300, 100, 1, ?)", iso(now));

  // customers
  const customers = [];
  for (let i = 0; i < 18; i++) {
    const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 5) % LAST.length]}`;
    const phone = `+961${pick(['70', '71', '76', '78', '79', '81'])}${String(100000 + Math.floor(r() * 899999))}`;
    const created = now - Math.floor(r() * 60) * 86400000;
    const res = db.run(
      "INSERT OR IGNORE INTO customers (name, phone, email, password_hash, created_at) VALUES (?, ?, NULL, 'pbkdf2$1000$AAAA$AAAA', ?)",
      name,
      phone,
      iso(created),
    );
    if (res.changes) customers.push({ id: res.lastInsertRowid, name, phone });
  }

  const imageOf = (v) => {
    try {
      const imgs = JSON.parse(v.images);
      return (imgs.find((i) => i.color && i.color === v.color_en) || imgs[0])?.url || '';
    } catch {
      return '';
    }
  };

  // Order times: a few today (after midnight in Beirut), the rest spread over ~6 weeks during opening hours,
  // sorted so order numbers increase with time like in a real shop.
  const H = 3600000;
  const sinceMidnight = beirutMsSinceMidnight(now);
  const midnight = now - sinceMidnight;
  const times = [];
  const recentCount = 4;
  // The latest orders arrived during the last few hours (after midnight when possible).
  const recentWindow = sinceMidnight >= 3 * H ? Math.min(sinceMidnight, 9 * H) : 8 * H;
  for (let i = 0; i < recentCount; i++) times.push(now - Math.max(4 * 60000, Math.floor(r() * recentWindow)));
  // The rest over ~10 weeks during opening hours, slightly busier lately (the dashboard compares periods).
  for (let i = recentCount; i < 92; i++) {
    const d = 1 + Math.floor(Math.pow(r(), 1.15) * 68);
    times.push(midnight - d * 24 * H + Math.floor((9 + r() * 13) * H));
  }
  times.sort((a, b) => a - b);

  let number = 1001;
  for (const t of times) {
    const ageH = (now - t) / H;
    const lines = [];
    if (r() < 0.45) lines.push([pick(phones), 1]);
    const extra = 1 + Math.floor(r() * 2);
    for (let k = 0; k < extra; k++) lines.push([pick(others), r() < 0.2 ? 2 : 1]);
    const uniq = new Map();
    for (const [v, q] of lines) uniq.set(v.id, [v, (uniq.get(v.id)?.[1] || 0) + q]);
    const items = [...uniq.values()];
    const subtotal = round2(items.reduce((s, [v, q]) => s + v.price * q, 0));
    const pickup = r() < 0.08;
    const zone = pickup ? null : weighted(r, ZONE_WEIGHTS);
    const fee = pickup || subtotal >= 100 ? 0 : FEES[zone];
    const pay = pickup ? pick(['store', 'store', 'whish']) : weighted(r, [['cod', 62], ['whish', 26], ['omt', 12]]);
    let status;
    if (ageH >= 72) status = r() < 0.07 ? 'cancelled' : 'delivered';
    else if (ageH >= 14) status = pick(['confirmed', 'shipped', 'delivered', pickup ? 'ready' : 'shipped']);
    else status = pick(['pending', 'pending', 'confirmed']);
    const cust = r() < 0.6 && customers.length ? pick(customers) : null;
    const name = cust ? cust.name : `${pick(FIRST)} ${pick(LAST)}`;
    const phone = cust ? cust.phone : `+961${pick(['70', '71', '76', '3', '81'])}${String(100000 + Math.floor(r() * 899999))}`;
    const paid = status === 'delivered' || ((pay === 'whish' || pay === 'omt') && status !== 'pending' && status !== 'cancelled');
    const total = round2(subtotal + fee);
    const steps = { pending: ['pending'], confirmed: ['pending', 'confirmed'], shipped: ['pending', 'confirmed', 'shipped'], ready: ['pending', 'confirmed', 'ready'], delivered: ['pending', 'confirmed', pickup ? 'ready' : 'shipped', 'delivered'], cancelled: ['pending', 'cancelled'] }[status];
    // events never land in the future: spread them over the time since the order (max 5h apart)
    const step = Math.floor(Math.min(5 * H, (now - t) / (steps.length + 0.5)));
    const res = db.run(
      `INSERT INTO orders (number, access_key, customer_id, status, delivery_method, payment_method, payment_status, subtotal, discount, delivery_fee, total,
         lbp_rate, customer_name, customer_phone, zone, city, street, building, floor, lang, is_demo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 89500, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      String(number++),
      Math.floor(r() * 1e12).toString(16),
      cust?.id || null,
      status,
      pickup ? 'pickup' : 'delivery',
      pay,
      paid ? 'paid' : 'unpaid',
      subtotal,
      fee,
      total,
      name,
      phone,
      zone,
      zone ? pick(CITIES[zone]) : null,
      zone ? `${pick(['Main', 'Bliss', 'Sassine', 'Church', 'Old', 'Highway'])} Street` : null,
      zone ? `${pick(['Cedar', 'Rose', 'Sky', 'Nour', 'Al Amal', 'Marina'])} Bldg` : null,
      zone ? String(1 + Math.floor(r() * 9)) : null,
      r() < 0.4 ? 'ar' : 'en',
      iso(t),
      iso(t + (steps.length - 1) * step),
    );
    const oid = res.lastInsertRowid;
    for (const [v, q] of items) {
      db.run(
        `INSERT INTO order_items (order_id, product_id, variant_id, slug, name_en, name_ar, variant_en, variant_ar, sku, image, unit_price, qty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        oid,
        v.product_id,
        v.id,
        v.slug,
        v.name_en,
        v.name_ar,
        [v.color_en, v.opt].filter(Boolean).join(' · '),
        [v.color_ar || v.color_en, v.opt].filter(Boolean).join(' · '),
        v.sku,
        imageOf(v),
        v.price,
        q,
      );
    }
    steps.forEach((s, k) => {
      db.run('INSERT INTO order_events (order_id, status, note, actor, created_at) VALUES (?, ?, NULL, ?, ?)', oid, s, k === 0 ? 'customer' : 'Demo Admin', iso(t + k * step));
    });
  }

  // search insights
  const searches = [
    ['iphone 17 pro', 6, 14],
    ['ايفون', 9, 11],
    ['charger', 5, 9],
    ['كفر', 3, 8],
    ['airpods', 2, 7],
    ['galaxy s25', 4, 6],
    ['power bank', 2, 5],
    ['nothing phone', 0, 4],
    ['huawei', 0, 3],
    ['pixel 10', 1, 2],
  ];
  for (const [q, results, n] of searches) {
    for (let k = 0; k < n; k++) db.run('INSERT INTO search_log (q, results, created_at) VALUES (?, ?, ?)', q, results, iso(now - Math.floor(r() * 20) * 86400000));
  }

  // trade-in requests
  const tr = [
    ['Karim Daher', '+96170123456', 'iPhone 13 Pro', '256GB', 'good', 86, 'iPhone 17 Pro'],
    ['Nour Hamdan', '+96176543210', 'Galaxy S22', '128GB', 'like_new', 91, 'Galaxy S25'],
    ['Elie Aoun', '+96181234567', 'iPhone 11', '64GB', 'fair', 78, ''],
  ];
  tr.forEach(([name, phone, device, storage, condition, battery, wants], k) => {
    db.run(
      "INSERT INTO tradeins (name, phone, device, storage, condition, battery, wants, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      name,
      phone,
      device,
      storage,
      condition,
      battery,
      wants || null,
      k === 2 ? 'contacted' : 'new',
      iso(now - (k + 1) * 7200000),
      iso(now - (k + 1) * 7200000),
    );
  });

  // back-in-stock requests on sold-out options
  const soldOut = db.all('SELECT id, product_id FROM variants WHERE stock = 0 LIMIT 3');
  soldOut.forEach((v, k) => {
    db.run('INSERT INTO stock_alerts (product_id, variant_id, contact, created_at) VALUES (?, ?, ?, ?)', v.product_id, v.id, `+96171${String(200000 + k * 31337)}`, iso(now - k * 86400000));
  });
}

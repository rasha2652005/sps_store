// Catalog snapshot: every active product with its variants, shaped for the storefront and cached in memory
// until something changes (catalog_version in the meta table).
import { catalogVersion } from './schema.js';
import { parseJson, int, num } from './util.js';
import { buildIndex, normalize, search } from './search.js';

const cache = new WeakMap();

export function getCatalog(db) {
  const v = catalogVersion(db);
  const hit = cache.get(db);
  if (hit && hit.version === v) return hit.data;
  const data = buildCatalog(db);
  cache.set(db, { version: v, data });
  return data;
}

export const deviceKey = (s) => normalize(s).replace(/\s+/g, '');

// ---------- colors ----------
export const COLOR_FAMILIES = {
  black: '#18181b',
  white: '#ffffff',
  silver: '#d4d4d8',
  gray: '#71717a',
  blue: '#3b82f6',
  green: '#22c55e',
  purple: '#a855f7',
  pink: '#f472b6',
  red: '#ef4444',
  orange: '#f97316',
  gold: '#d4a537',
};

export function colorFamily(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  if (l < 0.2) return 'black';
  if (l > 0.93) return 'white';
  if (s < 0.14 || (s < 0.22 && l > 0.8)) return l > 0.62 ? (l > 0.86 ? 'white' : 'silver') : 'gray';
  if (h < 14 || h >= 345) return l > 0.68 ? 'pink' : 'red';
  if (h < 38) return l > 0.75 ? 'gold' : 'orange';
  if (h < 62) return 'gold';
  if (h < 168) return 'green';
  if (h < 255) return 'blue';
  if (h < 292) return 'purple';
  return 'pink';
}

// ---------- options ("256GB", "1TB", "42mm"...) ----------
export function optSortKey(v) {
  const m = /^(\d+(?:\.\d+)?)\s*(tb|gb|mm|m|w|mah)?/i.exec(String(v || '').trim());
  if (!m) return [1, String(v || '').toLowerCase()];
  let n = Number(m[1]);
  if ((m[2] || '').toLowerCase() === 'tb') n *= 1024;
  return [0, n];
}
const cmpOpt = (a, b) => {
  const x = optSortKey(a);
  const y = optSortKey(b);
  if (x[0] !== y[0]) return x[0] - y[0];
  return x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0;
};

function buildCatalog(db) {
  const categories = db
    .all('SELECT * FROM categories ORDER BY sort, name_en')
    .map((c) => ({ id: c.id, slug: c.slug, name: { en: c.name_en, ar: c.name_ar || c.name_en }, icon: c.icon, kind: c.kind, sort: c.sort }));
  const brands = db.all('SELECT * FROM brands ORDER BY sort, name').map((b) => ({ id: b.id, slug: b.slug, name: b.name, sort: b.sort }));
  const catById = new Map(categories.map((c) => [c.id, c]));
  const brandById = new Map(brands.map((b) => [b.id, b]));

  const rows = db.all('SELECT * FROM products WHERE active = 1');
  const variants = db.all(
    'SELECT v.* FROM variants v JOIN products p ON p.id = v.product_id WHERE p.active = 1 ORDER BY v.product_id, v.sort, v.id',
  );
  const vByProduct = new Map();
  for (const v of variants) {
    if (!vByProduct.has(v.product_id)) vByProduct.set(v.product_id, []);
    vByProduct.get(v.product_id).push(v);
  }

  const now = Date.now();
  const products = [];
  for (const r of rows) {
    const vs = vByProduct.get(r.id) || [];
    if (!vs.length) continue;
    products.push(shapeProduct(r, vs, catById, brandById, now));
  }

  // Counts per category / brand for menus.
  const catCount = new Map();
  const brandCount = new Map();
  for (const p of products) {
    if (p.category) catCount.set(p.category.id, (catCount.get(p.category.id) || 0) + 1);
    if (p.brand) brandCount.set(p.brand.id, (brandCount.get(p.brand.id) || 0) + 1);
  }
  for (const c of categories) c.count = catCount.get(c.id) || 0;
  for (const b of brands) b.count = brandCount.get(b.id) || 0;

  // Devices for the "find accessories for your phone" tool.
  const devMap = new Map();
  const addDevice = (name, brand) => {
    const k = deviceKey(name);
    if (!k || k === 'universal') return;
    const cur = devMap.get(k) || { name, brand: brand || guessBrand(name), accessories: 0, sold_here: false };
    devMap.set(k, cur);
    return cur;
  };
  for (const p of products) {
    if (p.device) {
      const d = addDevice(p.device, p.brand?.name);
      if (d) d.sold_here = true;
    }
  }
  for (const p of products) {
    for (const f of p.fits) {
      const d = addDevice(f);
      if (d) d.accessories++;
    }
  }
  const devices = [...devMap.values()].sort(
    (a, b) => a.brand.localeCompare(b.brand) || b.name.localeCompare(a.name, 'en', { numeric: true }),
  );

  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const byId = new Map(products.map((p) => [p.id, p]));
  let index = null;
  return {
    categories,
    brands,
    products,
    bySlug,
    byId,
    devices,
    get index() {
      if (!index) index = buildIndex(products);
      return index;
    },
  };
}

function guessBrand(name) {
  const n = String(name).toLowerCase();
  if (/iphone|ipad|apple|airpods/.test(n)) return 'Apple';
  if (/galaxy|samsung/.test(n)) return 'Samsung';
  if (/pixel|google/.test(n)) return 'Google';
  if (/redmi|xiaomi|poco/.test(n)) return 'Xiaomi';
  return 'Other';
}

function shapeProduct(r, vs, catById, brandById, now) {
  const images = parseJson(r.images, []).filter((i) => i && i.url);
  const colors = [];
  const seenColor = new Set();
  const opts = [];
  for (const v of vs) {
    if (v.color_en && !seenColor.has(v.color_en)) {
      seenColor.add(v.color_en);
      colors.push({ en: v.color_en, ar: v.color_ar || v.color_en, hex: v.color_hex || '#cccccc', family: colorFamily(v.color_hex) });
    }
    if (v.opt && !opts.includes(v.opt)) opts.push(v.opt);
  }
  opts.sort(cmpOpt);
  const prices = vs.map((v) => v.price);
  const inStock = vs.filter((v) => v.stock > 0);
  const priceMin = Math.min(...(inStock.length ? inStock : vs).map((v) => v.price));
  const priceMax = Math.max(...prices);
  const cheapest = (inStock.length ? inStock : vs).reduce((a, b) => (b.price < a.price ? b : a));
  let discountPct = 0;
  for (const v of vs) {
    if (v.compare_at && v.compare_at > v.price) discountPct = Math.max(discountPct, Math.round((1 - v.price / v.compare_at) * 100));
  }
  const created = r.created_at ? Date.parse(r.created_at) : 0;
  const dealEnds = r.deal_ends_at && Date.parse(r.deal_ends_at) > now ? r.deal_ends_at : null;
  const cat = catById.get(r.category_id) || null;
  const brand = brandById.get(r.brand_id) || null;
  return {
    id: r.id,
    slug: r.slug,
    name: { en: r.name_en, ar: r.name_ar || r.name_en },
    subtitle: { en: r.subtitle_en || '', ar: r.subtitle_ar || r.subtitle_en || '' },
    description: { en: r.description_en || '', ar: r.description_ar || '' },
    category: cat ? { id: cat.id, slug: cat.slug, name: cat.name, kind: cat.kind } : null,
    brand: brand ? { id: brand.id, slug: brand.slug, name: brand.name } : null,
    condition: r.condition || 'new',
    warranty: { en: r.warranty_en || '', ar: r.warranty_ar || r.warranty_en || '' },
    opt_label: { en: r.opt_label_en || '', ar: r.opt_label_ar || r.opt_label_en || '' },
    device: r.device || '',
    images,
    specs: parseJson(r.specs, []),
    tags: String(r.tags || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    fits: parseJson(r.fits, []),
    featured: !!r.featured,
    deal_ends_at: dealEnds,
    rating: { avg: r.rating_avg || 0, count: r.rating_count || 0 },
    sold_count: r.sold_count || 0,
    created_at: r.created_at,
    is_new: created > 0 && now - created < 45 * 86400000,
    colors,
    opts,
    price_min: priceMin,
    price_max: priceMax,
    compare_at: cheapest.compare_at && cheapest.compare_at > cheapest.price ? cheapest.compare_at : null,
    discount_pct: discountPct,
    in_stock: inStock.length > 0,
    low_stock: inStock.length > 0 && inStock.reduce((s, v) => s + v.stock, 0) <= 3,
    variants: vs.map((v) => ({
      id: v.id,
      sku: v.sku || '',
      color_en: v.color_en || '',
      color_ar: v.color_ar || v.color_en || '',
      color_hex: v.color_hex || '',
      opt: v.opt || '',
      price: v.price,
      compare_at: v.compare_at && v.compare_at > v.price ? v.compare_at : null,
      stock: Math.max(0, Math.min(v.stock, 25)),
    })),
  };
}

/** Light version for product cards / lists. */
export function cardOf(p) {
  if (!p) return null;
  const { description, specs, ...rest } = p;
  return { ...rest, images: p.images.slice(0, 6) };
}

// ---------- listing with filters, facets and sorting ----------
const list = (v) =>
  String(v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export function listProducts(db, q = {}) {
  const cat = getCatalog(db);
  const page = int(q.page, 1, 1, 1000);
  const limit = int(q.limit, 24, 1, 60);
  const sort = String(q.sort || '');

  let pool = cat.products;
  let relevance = null;
  let correction = null;
  const query = String(q.q || '').trim().slice(0, 100);
  if (query) {
    const r = search(cat.index, query);
    relevance = new Map(r.results.map((x, i) => [x.p.id, i]));
    pool = r.results.map((x) => x.p);
    correction = r.correction;
  }
  if (q.ids) {
    const ids = list(q.ids).map(Number);
    const order = new Map(ids.map((id, i) => [id, i]));
    pool = pool.filter((p) => order.has(p.id)).sort((a, b) => order.get(a.id) - order.get(b.id));
  }

  const f = {
    category: list(q.category),
    brand: list(q.brand),
    condition: list(q.condition),
    opt: list(q.opt),
    color: list(q.color),
    min: q.min !== undefined && q.min !== '' ? num(q.min, null) : null,
    max: q.max !== undefined && q.max !== '' ? num(q.max, null) : null,
    in_stock: q.in_stock === '1' || q.in_stock === 1 || q.in_stock === true,
    deals: q.deals === '1' || q.deals === 1 || q.deals === true,
    is_new: q.new === '1',
    featured: q.featured === '1',
    fits: String(q.fits || '').trim(),
    kind: list(q.kind),
  };
  const fitsKey = f.fits ? deviceKey(f.fits) : '';

  const tests = {
    category: (p) => !f.category.length || (p.category && f.category.includes(p.category.slug)),
    brand: (p) => !f.brand.length || (p.brand && f.brand.includes(p.brand.slug)),
    condition: (p) => !f.condition.length || f.condition.includes(p.condition),
    opt: (p) => !f.opt.length || p.opts.some((o) => f.opt.includes(o)),
    color: (p) => !f.color.length || p.colors.some((c) => f.color.includes(c.family)),
    price: (p) => (f.min === null || p.price_min >= f.min) && (f.max === null || p.price_min <= f.max),
    other: (p) =>
      (!f.in_stock || p.in_stock) &&
      (!f.deals || p.discount_pct > 0) &&
      (!f.is_new || p.is_new) &&
      (!f.featured || p.featured) &&
      (!f.kind.length || (p.category && f.kind.includes(p.category.kind))) &&
      (!fitsKey || p.fits.some((x) => deviceKey(x) === fitsKey || deviceKey(x) === 'universal')),
  };
  const names = Object.keys(tests);
  const passAllExcept = (p, skip) => names.every((n) => n === skip || tests[n](p));

  const items = pool.filter((p) => passAllExcept(p, null));

  // Facets (each facet ignores its own filter so users can pick several values).
  const count = (skip, keyFn) => {
    const m = new Map();
    for (const p of pool) {
      if (!passAllExcept(p, skip)) continue;
      for (const k of keyFn(p)) m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  };
  const catCounts = count('category', (p) => (p.category ? [p.category.slug] : []));
  const brandCounts = count('brand', (p) => (p.brand ? [p.brand.slug] : []));
  const condCounts = count('condition', (p) => [p.condition]);
  const optCounts = count('opt', (p) => p.opts.filter((o) => /^\d+(\.\d+)?\s*(gb|tb)$/i.test(o)));
  const colorCounts = count('color', (p) => [...new Set(p.colors.map((c) => c.family).filter(Boolean))]);
  let pmin = Infinity;
  let pmax = 0;
  for (const p of pool) {
    if (!passAllExcept(p, 'price')) continue;
    pmin = Math.min(pmin, p.price_min);
    pmax = Math.max(pmax, p.price_min);
  }

  const facets = {
    categories: cat.categories.filter((c) => catCounts.get(c.slug)).map((c) => ({ slug: c.slug, name: c.name, count: catCounts.get(c.slug) })),
    brands: cat.brands.filter((b) => brandCounts.get(b.slug)).map((b) => ({ slug: b.slug, name: b.name, count: brandCounts.get(b.slug) })),
    conditions: ['new', 'used', 'refurbished'].filter((c) => condCounts.get(c)).map((c) => ({ value: c, count: condCounts.get(c) })),
    opts: [...optCounts.keys()].sort(cmpOpt).map((o) => ({ value: o, count: optCounts.get(o) })),
    colors: Object.keys(COLOR_FAMILIES)
      .filter((c) => colorCounts.get(c))
      .map((c) => ({ value: c, hex: COLOR_FAMILIES[c], count: colorCounts.get(c) })),
    price: { min: pmin === Infinity ? 0 : Math.floor(pmin), max: Math.ceil(pmax) },
  };

  const sorters = {
    newest: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
    price_asc: (a, b) => a.price_min - b.price_min,
    price_desc: (a, b) => b.price_min - a.price_min,
    popular: (a, b) => b.sold_count - a.sold_count,
    discount: (a, b) => b.discount_pct - a.discount_pct,
    featured: (a, b) =>
      Number(b.in_stock) - Number(a.in_stock) ||
      Number(b.featured) - Number(a.featured) ||
      b.sold_count - a.sold_count ||
      String(b.created_at).localeCompare(String(a.created_at)),
  };
  let sorted = items;
  if (sorters[sort]) sorted = [...items].sort(sorters[sort]);
  else if (relevance) sorted = [...items].sort((a, b) => relevance.get(a.id) - relevance.get(b.id));
  else if (!q.ids) sorted = [...items].sort(sorters.featured);

  const total = sorted.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  return {
    items: sorted.slice((page - 1) * limit, page * limit).map(q.full === '1' ? (p) => p : cardOf),
    total,
    page,
    pages,
    facets,
    correction: total ? null : correction,
    suggestion: correction,
  };
}

export function productsBySlugs(db, slugs) {
  const cat = getCatalog(db);
  return slugs.map((s) => cat.bySlug.get(s)).filter(Boolean);
}

/** Full product page payload. */
export function productDetail(db, slug) {
  const cat = getCatalog(db);
  const p = cat.bySlug.get(slug);
  if (!p) return null;

  // Related: same category, closest price, same brand first.
  const related = cat.products
    .filter((x) => x.id !== p.id && x.category && p.category && x.category.id === p.category.id)
    .map((x) => ({ x, d: Math.abs(x.price_min - p.price_min) / Math.max(1, p.price_min) - (x.brand?.id === p.brand?.id ? 0.3 : 0) - (x.in_stock ? 0.1 : 0) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 10)
    .map((r) => cardOf(r.x));

  // Accessories that fit this device (exact fits first, then universal ones).
  let accessories = [];
  if (p.device) {
    const k = deviceKey(p.device);
    const exact = [];
    const universal = [];
    for (const x of cat.products) {
      if (x.id === p.id) continue;
      const keys = x.fits.map(deviceKey);
      if (keys.includes(k)) exact.push(x);
      else if (keys.includes('universal') && x.category?.kind === 'accessory') universal.push(x);
    }
    const rank = (a, b) => Number(b.in_stock) - Number(a.in_stock) || b.sold_count - a.sold_count;
    accessories = [...exact.sort(rank), ...universal.sort(rank)].slice(0, 12).map(cardOf);
  }

  // Phones in the store that this accessory fits.
  let fitsProducts = [];
  if (p.fits.length) {
    const keys = new Set(p.fits.map(deviceKey));
    fitsProducts = cat.products.filter((x) => x.device && keys.has(deviceKey(x.device))).slice(0, 8).map(cardOf);
  }

  // Often bought together (from real orders).
  const together = db
    .all(
      `SELECT oi2.product_id AS id, COUNT(*) AS c FROM order_items oi1
       JOIN order_items oi2 ON oi2.order_id = oi1.order_id AND oi2.product_id != oi1.product_id
       JOIN orders o ON o.id = oi1.order_id AND o.status != 'cancelled'
       WHERE oi1.product_id = ? GROUP BY oi2.product_id ORDER BY c DESC LIMIT 8`,
      p.id,
    )
    .map((r) => cat.byId.get(r.id))
    .filter(Boolean)
    .slice(0, 6)
    .map(cardOf);

  const dist = [0, 0, 0, 0, 0];
  for (const r of db.all('SELECT rating, COUNT(*) AS c FROM reviews WHERE product_id = ? AND hidden = 0 GROUP BY rating', p.id)) {
    if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1] = r.c;
  }

  return { product: p, related, accessories, fits_products: fitsProducts, together, rating_distribution: dist };
}

/** Recomputes the cached rating of a product. */
export function refreshRating(db, productId) {
  const r = db.get('SELECT AVG(rating) AS avg, COUNT(*) AS c FROM reviews WHERE product_id = ? AND hidden = 0', productId);
  db.run('UPDATE products SET rating_avg = ?, rating_count = ? WHERE id = ?', r?.avg ? Math.round(r.avg * 10) / 10 : 0, r?.c || 0, productId);
}

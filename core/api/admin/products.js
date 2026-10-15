// Admin: products, variants and image uploads.
import { bad, notFound } from '../../errors.js';
import { bumpCatalog } from '../../schema.js';
import { escapeLike, int, isoNow, num, optStr, parseJson, slugify, str, tx, uniqueSlug } from '../../util.js';

const CONDITIONS = ['new', 'used', 'refurbished'];
const HEX = /^#[0-9a-f]{6}$/i;

function shapeAdmin(db, p) {
  const variants = db.all('SELECT * FROM variants WHERE product_id = ? ORDER BY sort, id', p.id);
  return {
    ...p,
    featured: !!p.featured,
    active: !!p.active,
    is_demo: !!p.is_demo,
    images: parseJson(p.images, []),
    specs: parseJson(p.specs, []),
    fits: parseJson(p.fits, []),
    variants,
    alerts: db.get('SELECT COUNT(*) AS n FROM stock_alerts WHERE product_id = ? AND notified_at IS NULL', p.id).n,
  };
}

export async function list(ctx) {
  const page = int(ctx.query.page, 1, 1, 10000);
  const limit = int(ctx.query.limit, 25, 5, 100);
  const where = [];
  const args = [];
  const q = String(ctx.query.q || '').trim();
  if (q) {
    const like = `%${escapeLike(q)}%`;
    where.push("(p.name_en LIKE ? ESCAPE '\\' OR p.name_ar LIKE ? ESCAPE '\\' OR p.slug LIKE ? ESCAPE '\\' OR p.tags LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM variants v WHERE v.product_id = p.id AND v.sku LIKE ? ESCAPE '\\'))");
    args.push(like, like, like, like, like);
  }
  if (ctx.query.category) {
    where.push('p.category_id = ?');
    args.push(int(ctx.query.category, 0));
  }
  if (ctx.query.brand) {
    where.push('p.brand_id = ?');
    args.push(int(ctx.query.brand, 0));
  }
  if (ctx.query.status === 'active') where.push('p.active = 1');
  if (ctx.query.status === 'hidden') where.push('p.active = 0');
  if (ctx.query.stock === 'out') where.push('NOT EXISTS (SELECT 1 FROM variants v WHERE v.product_id = p.id AND v.stock > 0)');
  if (ctx.query.stock === 'low') where.push('EXISTS (SELECT 1 FROM variants v WHERE v.product_id = p.id AND v.stock <= 3)');
  const sql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sorts = {
    newest: 'p.id DESC',
    name: 'p.name_en COLLATE NOCASE',
    stock: 'stock ASC',
    sold: 'p.sold_count DESC',
    price: 'price_min ASC',
  };
  const order = sorts[ctx.query.sort] || sorts.newest;
  const total = ctx.db.get(`SELECT COUNT(*) AS n FROM products p ${sql}`, ...args).n;
  const rows = ctx.db.all(
    `SELECT p.id, p.slug, p.name_en, p.name_ar, p.images, p.active, p.featured, p.condition, p.sold_count, p.category_id, p.brand_id, p.updated_at,
       c.name_en AS category_en, c.name_ar AS category_ar, b.name AS brand,
       (SELECT MIN(price) FROM variants WHERE product_id = p.id) AS price_min,
       (SELECT MAX(price) FROM variants WHERE product_id = p.id) AS price_max,
       (SELECT IFNULL(SUM(stock), 0) FROM variants WHERE product_id = p.id) AS stock,
       (SELECT COUNT(*) FROM variants WHERE product_id = p.id) AS variant_count,
       (SELECT COUNT(*) FROM stock_alerts WHERE product_id = p.id AND notified_at IS NULL) AS alerts
     FROM products p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN brands b ON b.id = p.brand_id
     ${sql} ORDER BY ${order} LIMIT ? OFFSET ?`,
    ...args,
    limit,
    (page - 1) * limit,
  );
  const variantsOf = (id) => ctx.db.all('SELECT id, color_en, color_hex, opt, price, compare_at, stock, sku FROM variants WHERE product_id = ? ORDER BY sort, id', id);
  return {
    items: rows.map((r) => ({ ...r, active: !!r.active, featured: !!r.featured, image: parseJson(r.images, [])[0]?.url || '', images: undefined, variants: variantsOf(r.id) })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function get(ctx) {
  const p = ctx.db.get('SELECT * FROM products WHERE id = ?', int(ctx.params.id, 0));
  if (!p) throw notFound('product_not_found', 'Product not found');
  return { product: shapeAdmin(ctx.db, p) };
}

function validUrl(u, demo) {
  const s = String(u || '');
  if (s.startsWith('/uploads/')) return s.length < 300;
  if (/^https:\/\/[^\s]+$/i.test(s)) return s.length < 1000;
  if (demo && /^data:image\/(png|jpeg|webp|gif|avif|svg\+xml)[;,]/i.test(s)) return s.length < 4_000_000;
  return false;
}

function cleanProduct(db, b, { demo, id = null }) {
  const name_en = str(b.name_en, 160);
  if (name_en.length < 2) throw bad('name_required', 'Product name is required', { field: 'name_en' });
  const category_id = b.category_id ? int(b.category_id, 0) : null;
  if (category_id && !db.get('SELECT id FROM categories WHERE id = ?', category_id)) throw bad('category_invalid', 'Unknown category', { field: 'category_id' });
  const brand_id = b.brand_id ? int(b.brand_id, 0) : null;
  if (brand_id && !db.get('SELECT id FROM brands WHERE id = ?', brand_id)) throw bad('brand_invalid', 'Unknown brand', { field: 'brand_id' });

  const images = (Array.isArray(b.images) ? b.images : [])
    .slice(0, 20)
    .filter((i) => i && validUrl(i.url, demo))
    .map((i) => ({ url: String(i.url), color: optStr(i.color, 60) || undefined }));
  const specs = (Array.isArray(b.specs) ? b.specs : [])
    .slice(0, 40)
    .map((s) => ({ key: str(s?.key, 60), value: str(s?.value, 300) }))
    .filter((s) => s.key && s.value);
  const fits = [...new Set((Array.isArray(b.fits) ? b.fits : String(b.fits || '').split(',')).map((f) => str(f, 80)).filter(Boolean))].slice(0, 80);
  const tags = (Array.isArray(b.tags) ? b.tags.join(',') : str(b.tags, 500))
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 30)
    .join(', ');

  const variants = (Array.isArray(b.variants) ? b.variants : []).slice(0, 120).map((v, i) => {
    const price = num(v?.price, NaN, 0, 1e7);
    if (!Number.isFinite(price)) throw bad('variant_price_required', 'Every option needs a price', { field: 'variants', index: i });
    const compare = v?.compare_at === '' || v?.compare_at == null ? null : num(v.compare_at, null, 0, 1e7);
    const hex = str(v?.color_hex, 7);
    return {
      id: v?.id ? int(v.id, 0) : null,
      sku: optStr(v?.sku, 60),
      color_en: optStr(v?.color_en, 60),
      color_ar: optStr(v?.color_ar, 60),
      color_hex: HEX.test(hex) ? hex.toLowerCase() : null,
      opt: optStr(v?.opt, 40),
      price,
      compare_at: compare && compare > price ? compare : null,
      stock: int(v?.stock, 0, 0, 1000000),
      sort: i,
    };
  });
  if (!variants.length) throw bad('variants_required', 'Add at least one price / option', { field: 'variants' });
  const combos = new Set();
  for (const v of variants) {
    const k = `${(v.color_en || '').toLowerCase()}|${(v.opt || '').toLowerCase()}`;
    if (combos.has(k)) throw bad('duplicate_variant', 'Two options have the same color and size', { field: 'variants' });
    combos.add(k);
  }

  let deal = null;
  if (b.deal_ends_at) {
    const t = Date.parse(b.deal_ends_at);
    if (Number.isFinite(t)) deal = new Date(t).toISOString();
  }
  const slugBase = str(b.slug, 90) ? slugify(b.slug) : slugify(name_en);
  return {
    fields: {
      slug: uniqueSlug(db, 'products', slugBase || name_en, id),
      name_en,
      name_ar: str(b.name_ar, 160),
      subtitle_en: str(b.subtitle_en, 200),
      subtitle_ar: str(b.subtitle_ar, 200),
      description_en: str(b.description_en, 8000),
      description_ar: str(b.description_ar, 8000),
      category_id,
      brand_id,
      condition: CONDITIONS.includes(b.condition) ? b.condition : 'new',
      warranty_en: str(b.warranty_en, 120),
      warranty_ar: str(b.warranty_ar, 120),
      opt_label_en: str(b.opt_label_en, 30),
      opt_label_ar: str(b.opt_label_ar, 30),
      device: str(b.device, 80),
      images: JSON.stringify(images),
      specs: JSON.stringify(specs),
      tags,
      fits: JSON.stringify(fits),
      featured: b.featured ? 1 : 0,
      active: b.active === false || b.active === 0 ? 0 : 1,
      deal_ends_at: deal,
    },
    variants,
  };
}

function saveVariants(db, productId, variants) {
  const existing = new Map(db.all('SELECT id FROM variants WHERE product_id = ?', productId).map((r) => [r.id, true]));
  const keep = new Set();
  for (const v of variants) {
    if (v.id && existing.has(v.id)) {
      db.run(
        'UPDATE variants SET sku = ?, color_en = ?, color_ar = ?, color_hex = ?, opt = ?, price = ?, compare_at = ?, stock = ?, sort = ? WHERE id = ?',
        v.sku,
        v.color_en,
        v.color_ar,
        v.color_hex,
        v.opt,
        v.price,
        v.compare_at,
        v.stock,
        v.sort,
        v.id,
      );
      keep.add(v.id);
    } else {
      const r = db.run(
        'INSERT INTO variants (product_id, sku, color_en, color_ar, color_hex, opt, price, compare_at, stock, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        productId,
        v.sku,
        v.color_en,
        v.color_ar,
        v.color_hex,
        v.opt,
        v.price,
        v.compare_at,
        v.stock,
        v.sort,
      );
      keep.add(r.lastInsertRowid);
    }
  }
  for (const id of existing.keys()) if (!keep.has(id)) db.run('DELETE FROM variants WHERE id = ?', id);
}

export async function create(ctx) {
  const { fields, variants } = cleanProduct(ctx.db, ctx.body || {}, { demo: ctx.env.demo });
  const id = tx(ctx.db, () => {
    const now = isoNow();
    const cols = Object.keys(fields);
    const r = ctx.db.run(
      `INSERT INTO products (${cols.join(', ')}, created_at, updated_at) VALUES (${cols.map(() => '?').join(', ')}, ?, ?)`,
      ...cols.map((c) => fields[c]),
      now,
      now,
    );
    saveVariants(ctx.db, r.lastInsertRowid, variants);
    bumpCatalog(ctx.db);
    return r.lastInsertRowid;
  });
  return { product: shapeAdmin(ctx.db, ctx.db.get('SELECT * FROM products WHERE id = ?', id)) };
}

export async function update(ctx) {
  const id = int(ctx.params.id, 0);
  if (!ctx.db.get('SELECT id FROM products WHERE id = ?', id)) throw notFound('product_not_found', 'Product not found');
  const { fields, variants } = cleanProduct(ctx.db, ctx.body || {}, { demo: ctx.env.demo, id });
  tx(ctx.db, () => {
    const cols = Object.keys(fields);
    ctx.db.run(`UPDATE products SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, ...cols.map((c) => fields[c]), isoNow(), id);
    saveVariants(ctx.db, id, variants);
    bumpCatalog(ctx.db);
  });
  return { product: shapeAdmin(ctx.db, ctx.db.get('SELECT * FROM products WHERE id = ?', id)) };
}

export async function remove(ctx) {
  const id = int(ctx.params.id, 0);
  const r = ctx.db.run('DELETE FROM products WHERE id = ?', id);
  if (!r.changes) throw notFound('product_not_found', 'Product not found');
  bumpCatalog(ctx.db);
  return { ok: true };
}

export async function duplicate(ctx) {
  const id = int(ctx.params.id, 0);
  const p = ctx.db.get('SELECT * FROM products WHERE id = ?', id);
  if (!p) throw notFound('product_not_found', 'Product not found');
  const newId = tx(ctx.db, () => {
    const now = isoNow();
    const { id: _id, slug, created_at, updated_at, sold_count, rating_avg, rating_count, is_demo, ...rest } = p;
    const fields = { ...rest, name_en: `${p.name_en} (copy)`, name_ar: p.name_ar ? `${p.name_ar} (نسخة)` : '', active: 0, slug: uniqueSlug(ctx.db, 'products', `${p.slug}-copy`) };
    const cols = Object.keys(fields);
    const r = ctx.db.run(
      `INSERT INTO products (${cols.join(', ')}, created_at, updated_at) VALUES (${cols.map(() => '?').join(', ')}, ?, ?)`,
      ...cols.map((c) => fields[c]),
      now,
      now,
    );
    for (const v of ctx.db.all('SELECT * FROM variants WHERE product_id = ? ORDER BY sort, id', id)) {
      ctx.db.run(
        'INSERT INTO variants (product_id, sku, color_en, color_ar, color_hex, opt, price, compare_at, stock, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)',
        r.lastInsertRowid,
        null,
        v.color_en,
        v.color_ar,
        v.color_hex,
        v.opt,
        v.price,
        v.compare_at,
        v.sort,
      );
    }
    bumpCatalog(ctx.db);
    return r.lastInsertRowid;
  });
  return { product: shapeAdmin(ctx.db, ctx.db.get('SELECT * FROM products WHERE id = ?', newId)) };
}

/** Quick toggles from the products table (active / featured). */
export async function patch(ctx) {
  const id = int(ctx.params.id, 0);
  const p = ctx.db.get('SELECT id, active, featured FROM products WHERE id = ?', id);
  if (!p) throw notFound('product_not_found', 'Product not found');
  const b = ctx.body || {};
  const active = b.active === undefined ? p.active : b.active ? 1 : 0;
  const featured = b.featured === undefined ? p.featured : b.featured ? 1 : 0;
  ctx.db.run('UPDATE products SET active = ?, featured = ?, updated_at = ? WHERE id = ?', active, featured, isoNow(), id);
  bumpCatalog(ctx.db);
  return { product: { id, active: !!active, featured: !!featured } };
}

/** Quick inline edit from the products table. */
export async function patchVariant(ctx) {
  const id = int(ctx.params.id, 0);
  const v = ctx.db.get('SELECT * FROM variants WHERE id = ?', id);
  if (!v) throw notFound('variant_not_found', 'Option not found');
  const b = ctx.body || {};
  const stock = b.stock !== undefined ? int(b.stock, v.stock, 0, 1000000) : v.stock;
  const price = b.price !== undefined ? num(b.price, v.price, 0, 1e7) : v.price;
  let compare = v.compare_at;
  if (b.compare_at !== undefined) compare = b.compare_at === '' || b.compare_at === null ? null : num(b.compare_at, null, 0, 1e7);
  if (compare !== null && compare <= price) compare = null;
  ctx.db.run('UPDATE variants SET stock = ?, price = ?, compare_at = ? WHERE id = ?', stock, price, compare, id);
  ctx.db.run('UPDATE products SET updated_at = ? WHERE id = ?', isoNow(), v.product_id);
  bumpCatalog(ctx.db);
  return { variant: ctx.db.get('SELECT * FROM variants WHERE id = ?', id) };
}

const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp|gif|avif);base64,([A-Za-z0-9+/=]+)$/;

/** Saves a photo; an optional small version (thumb_data_url, same format) is stored next to it for lists. */
export async function upload(ctx) {
  const dataUrl = String(ctx.body?.data_url || '');
  const m = IMAGE_DATA_URL.exec(dataUrl);
  if (!m) throw bad('image_invalid', 'Please upload a JPG, PNG or WebP image');
  if ((m[2].length * 3) / 4 > 6 * 1024 * 1024) throw bad('image_too_big', 'Image is too big (max 6 MB)');
  const url = await ctx.storage.saveImage(dataUrl, m[1]);
  const thumb = String(ctx.body?.thumb_data_url || '');
  const t = IMAGE_DATA_URL.exec(thumb);
  if (t && t[1] === m[1] && (t[2].length * 3) / 4 <= 1024 * 1024) {
    try {
      await ctx.storage.saveImage(thumb, t[1], `${url.replace(/\.[a-z0-9]+$/i, '')}.t`);
    } catch {
      /* the full-size photo is saved; lists fall back to it */
    }
  }
  return { url };
}

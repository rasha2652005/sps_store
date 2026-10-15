// Admin: categories and brands.
import { bad, conflict, notFound } from '../../errors.js';
import { bumpCatalog } from '../../schema.js';
import { int, isoNow, slugify, str, uniqueSlug } from '../../util.js';

const KINDS = ['phone', 'tablet', 'audio', 'wearable', 'accessory'];

export async function taxonomy(ctx) {
  const categories = ctx.db.all(
    'SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS products FROM categories c ORDER BY c.sort, c.name_en',
  );
  const brands = ctx.db.all('SELECT b.*, (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id) AS products FROM brands b ORDER BY b.sort, b.name');
  return { categories, brands };
}

function cleanCategory(b) {
  const name_en = str(b.name_en, 60);
  if (name_en.length < 2) throw bad('name_required', 'Name is required', { field: 'name_en' });
  return {
    name_en,
    name_ar: str(b.name_ar, 60),
    icon: str(b.icon, 40) || 'package',
    kind: KINDS.includes(b.kind) ? b.kind : 'accessory',
    sort: int(b.sort, 0, -1000, 1000),
  };
}

export async function createCategory(ctx) {
  const c = cleanCategory(ctx.body || {});
  const slug = uniqueSlug(ctx.db, 'categories', str(ctx.body?.slug, 60) || c.name_en);
  ctx.db.run(
    'INSERT INTO categories (slug, name_en, name_ar, icon, kind, sort, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    slug,
    c.name_en,
    c.name_ar,
    c.icon,
    c.kind,
    c.sort,
    isoNow(),
  );
  bumpCatalog(ctx.db);
  return taxonomy(ctx);
}

export async function updateCategory(ctx) {
  const id = int(ctx.params.id, 0);
  if (!ctx.db.get('SELECT id FROM categories WHERE id = ?', id)) throw notFound('category_not_found', 'Category not found');
  const c = cleanCategory(ctx.body || {});
  const slug = ctx.body?.slug ? uniqueSlug(ctx.db, 'categories', slugify(ctx.body.slug), id) : null;
  ctx.db.run(
    'UPDATE categories SET name_en = ?, name_ar = ?, icon = ?, kind = ?, sort = ?, slug = COALESCE(?, slug) WHERE id = ?',
    c.name_en,
    c.name_ar,
    c.icon,
    c.kind,
    c.sort,
    slug,
    id,
  );
  bumpCatalog(ctx.db);
  return taxonomy(ctx);
}

export async function deleteCategory(ctx) {
  const id = int(ctx.params.id, 0);
  const n = ctx.db.get('SELECT COUNT(*) AS n FROM products WHERE category_id = ?', id).n;
  if (n) throw conflict('category_in_use', 'Move or delete the products in this category first', { products: n });
  ctx.db.run('DELETE FROM categories WHERE id = ?', id);
  bumpCatalog(ctx.db);
  return taxonomy(ctx);
}

export async function createBrand(ctx) {
  const name = str(ctx.body?.name, 60);
  if (name.length < 1) throw bad('name_required', 'Name is required', { field: 'name' });
  ctx.db.run('INSERT INTO brands (slug, name, sort) VALUES (?, ?, ?)', uniqueSlug(ctx.db, 'brands', name), name, int(ctx.body?.sort, 0, -1000, 1000));
  bumpCatalog(ctx.db);
  return taxonomy(ctx);
}

export async function updateBrand(ctx) {
  const id = int(ctx.params.id, 0);
  if (!ctx.db.get('SELECT id FROM brands WHERE id = ?', id)) throw notFound('brand_not_found', 'Brand not found');
  const name = str(ctx.body?.name, 60);
  if (name.length < 1) throw bad('name_required', 'Name is required', { field: 'name' });
  ctx.db.run('UPDATE brands SET name = ?, sort = ? WHERE id = ?', name, int(ctx.body?.sort, 0, -1000, 1000), id);
  bumpCatalog(ctx.db);
  return taxonomy(ctx);
}

export async function deleteBrand(ctx) {
  const id = int(ctx.params.id, 0);
  const n = ctx.db.get('SELECT COUNT(*) AS n FROM products WHERE brand_id = ?', id).n;
  if (n) throw conflict('brand_in_use', 'Move or delete the products of this brand first', { products: n });
  ctx.db.run('DELETE FROM brands WHERE id = ?', id);
  bumpCatalog(ctx.db);
  return taxonomy(ctx);
}

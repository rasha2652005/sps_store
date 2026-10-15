// Admin: store settings, coupons and demo-data cleanup.
import { bad, conflict, forbidden, notFound } from '../../errors.js';
import { DEFAULT_SETTINGS, getSettings, saveSettingsSection } from '../../settings.js';
import { bumpCatalog } from '../../schema.js';
import { int, isoNow, normalizePhone, num, optStr, slugify, str, tx } from '../../util.js';

export async function getAll(ctx) {
  return { settings: getSettings(ctx.db), defaults: DEFAULT_SETTINGS };
}

const s = (v, max = 200) => str(v, max);
const b = (v) => v === true || v === 1 || v === '1' || v === 'true';
const link = (v) => {
  const x = str(v, 300);
  return x.startsWith('/') || /^https:\/\//i.test(x) ? x : '';
};

const CLEAN = {
  store(v) {
    const whatsapp = str(v.whatsapp, 30);
    const wa = whatsapp ? normalizePhone(whatsapp) : '';
    if (whatsapp && !wa) throw bad('phone_invalid', 'WhatsApp number is not valid', { field: 'whatsapp' });
    return {
      name_en: s(v.name_en, 60) || DEFAULT_SETTINGS.store.name_en,
      name_ar: s(v.name_ar, 60),
      short_name: s(v.short_name, 12),
      tagline_en: s(v.tagline_en, 140),
      tagline_ar: s(v.tagline_ar, 140),
      phone: s(v.phone, 30),
      whatsapp: wa || '',
      email: s(v.email, 120),
      address_en: s(v.address_en, 200),
      address_ar: s(v.address_ar, 200),
      maps_url: link(v.maps_url),
      hours_en: s(v.hours_en, 120),
      hours_ar: s(v.hours_ar, 120),
      instagram: link(v.instagram),
      facebook: link(v.facebook),
      tiktok: link(v.tiktok),
    };
  },
  delivery(v) {
    const seen = new Set();
    const zones = (Array.isArray(v.zones) ? v.zones : []).slice(0, 40).map((z) => {
      const en = s(z.en, 60);
      if (!en) throw bad('zone_name_required', 'Every area needs a name', { field: 'zones' });
      let id = slugify(z.id || en) || `zone-${seen.size + 1}`;
      while (seen.has(id)) id = `${id}-2`;
      seen.add(id);
      return { id, en, ar: s(z.ar, 60), fee: num(z.fee, 0, 0, 1000) };
    });
    if (!zones.length) throw bad('zones_required', 'Add at least one delivery area', { field: 'zones' });
    return {
      free_over: num(v.free_over, 0, 0, 100000),
      eta_en: s(v.eta_en, 80),
      eta_ar: s(v.eta_ar, 80),
      pickup_enabled: b(v.pickup_enabled),
      zones,
    };
  },
  payments(v) {
    const acc = (x) => ({ enabled: b(x?.enabled), account_name: s(x?.account_name, 80), account_number: s(x?.account_number, 40) });
    const out = { cod: { enabled: b(v.cod?.enabled) }, whish: acc(v.whish), omt: acc(v.omt), store: { enabled: b(v.store?.enabled) } };
    if (!out.cod.enabled && !out.whish.enabled && !out.omt.enabled) throw bad('payments_required', 'Keep at least one payment method for delivery orders');
    return out;
  },
  currency(v) {
    return { lbp_rate: num(v.lbp_rate, 0, 0, 10000000), show_lbp: b(v.show_lbp) };
  },
  home(v) {
    const hero = (Array.isArray(v.hero) ? v.hero : []).slice(0, 6).map((h) => ({
      eyebrow_en: s(h.eyebrow_en, 40),
      eyebrow_ar: s(h.eyebrow_ar, 40),
      title_en: s(h.title_en, 80),
      title_ar: s(h.title_ar, 80),
      subtitle_en: s(h.subtitle_en, 200),
      subtitle_ar: s(h.subtitle_ar, 200),
      cta_en: s(h.cta_en, 40),
      cta_ar: s(h.cta_ar, 40),
      link: link(h.link) || '/shop',
      product_slug: s(h.product_slug, 90),
      color: s(h.color, 60),
      image: link(h.image) || (/^data:image\//.test(String(h.image || '')) ? String(h.image).slice(0, 3_000_000) : ''),
    }));
    const trust = (Array.isArray(v.trust) ? v.trust : []).slice(0, 4).map((x) => ({
      icon: ['truck', 'cash', 'shield', 'swap', 'clock', 'star', 'phone', 'gift'].includes(x.icon) ? x.icon : 'shield',
      title_en: s(x.title_en, 50),
      title_ar: s(x.title_ar, 50),
      text_en: s(x.text_en, 80),
      text_ar: s(x.text_ar, 80),
    }));
    return {
      announcement_en: s(v.announcement_en, 160),
      announcement_ar: s(v.announcement_ar, 160),
      trending: (Array.isArray(v.trending) ? v.trending : []).map((t) => s(t, 40)).filter(Boolean).slice(0, 10),
      trust,
      hero,
    };
  },
  policies(v) {
    const out = {};
    for (const k of Object.keys(DEFAULT_SETTINGS.policies)) out[k] = str(v[k], 4000);
    return out;
  },
  tradein(v) {
    return { enabled: b(v.enabled) };
  },
};

export async function put(ctx) {
  const section = ctx.params.section;
  if (!CLEAN[section]) throw notFound('settings_section', 'Unknown settings section');
  const clean = CLEAN[section](ctx.body || {});
  saveSettingsSection(ctx.db, section, clean);
  return { settings: getSettings(ctx.db) };
}

// ---------------- coupons ----------------
export async function coupons(ctx) {
  return { items: ctx.db.all('SELECT * FROM coupons ORDER BY id DESC').map((c) => ({ ...c, active: !!c.active })) };
}

function cleanCoupon(v) {
  const code = str(v.code, 30).toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) throw bad('coupon_code_invalid', 'Use 3–30 letters, numbers, - or _', { field: 'code' });
  const type = ['percent', 'fixed', 'shipping'].includes(v.type) ? v.type : 'percent';
  const value = type === 'shipping' ? 0 : num(v.value, NaN, 0, 100000);
  if (!Number.isFinite(value) || (type !== 'shipping' && value <= 0)) throw bad('coupon_value_invalid', 'Enter a discount value', { field: 'value' });
  if (type === 'percent' && value > 100) throw bad('coupon_value_invalid', 'A percentage cannot be more than 100', { field: 'value' });
  const date = (x) => {
    if (!x) return null;
    const t = Date.parse(x);
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
  };
  return {
    code,
    type,
    value,
    min_subtotal: num(v.min_subtotal, 0, 0, 1000000),
    starts_at: date(v.starts_at),
    ends_at: date(v.ends_at),
    usage_limit: v.usage_limit === '' || v.usage_limit == null ? null : int(v.usage_limit, null, 1, 1000000),
    per_customer_limit: v.per_customer_limit === '' || v.per_customer_limit == null ? null : int(v.per_customer_limit, null, 1, 1000),
    active: v.active === false || v.active === 0 ? 0 : 1,
  };
}

export async function createCoupon(ctx) {
  const c = cleanCoupon(ctx.body || {});
  if (ctx.db.get('SELECT id FROM coupons WHERE code = ? COLLATE NOCASE', c.code)) throw conflict('coupon_exists', 'This code already exists', { field: 'code' });
  ctx.db.run(
    'INSERT INTO coupons (code, type, value, min_subtotal, starts_at, ends_at, usage_limit, per_customer_limit, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    c.code,
    c.type,
    c.value,
    c.min_subtotal,
    c.starts_at,
    c.ends_at,
    c.usage_limit,
    c.per_customer_limit,
    c.active,
    isoNow(),
  );
  return coupons(ctx);
}

export async function updateCoupon(ctx) {
  const id = int(ctx.params.id, 0);
  if (!ctx.db.get('SELECT id FROM coupons WHERE id = ?', id)) throw notFound('coupon_not_found', 'Coupon not found');
  const c = cleanCoupon(ctx.body || {});
  if (ctx.db.get('SELECT id FROM coupons WHERE code = ? COLLATE NOCASE AND id != ?', c.code, id)) throw conflict('coupon_exists', 'This code already exists', { field: 'code' });
  ctx.db.run(
    'UPDATE coupons SET code = ?, type = ?, value = ?, min_subtotal = ?, starts_at = ?, ends_at = ?, usage_limit = ?, per_customer_limit = ?, active = ? WHERE id = ?',
    c.code,
    c.type,
    c.value,
    c.min_subtotal,
    c.starts_at,
    c.ends_at,
    c.usage_limit,
    c.per_customer_limit,
    c.active,
    id,
  );
  return coupons(ctx);
}

export async function deleteCoupon(ctx) {
  ctx.db.run('DELETE FROM coupons WHERE id = ?', int(ctx.params.id, 0));
  return coupons(ctx);
}

// ---------------- demo data ----------------
export async function demoInfo(ctx) {
  return {
    products: ctx.db.get('SELECT COUNT(*) AS n FROM products WHERE is_demo = 1').n,
    orders: ctx.db.get('SELECT COUNT(*) AS n FROM orders WHERE is_demo = 1').n,
  };
}

export async function clearDemo(ctx) {
  if (ctx.admin.role !== 'owner') throw forbidden('owner_only', 'Only the owner can do this');
  tx(ctx.db, () => {
    ctx.db.run('DELETE FROM orders WHERE is_demo = 1');
    ctx.db.run('DELETE FROM products WHERE is_demo = 1');
    const home = getSettings(ctx.db).home;
    saveSettingsSection(ctx.db, 'home', { ...home, hero: [] });
    bumpCatalog(ctx.db);
  });
  return demoInfo(ctx);
}

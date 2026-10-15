// Cart pricing. The server always recomputes prices, stock, coupons and delivery: the browser is never trusted.
import { round2, int, isoNow } from './util.js';

export const MAX_QTY_PER_LINE = 10;
export const MAX_LINES = 40;

/** Merge duplicate lines and sanitize input. */
export function cleanItems(items) {
  const m = new Map();
  for (const it of Array.isArray(items) ? items.slice(0, 100) : []) {
    const id = int(it?.variant_id, 0, 0);
    const qty = int(it?.qty, 0, 0, 100);
    if (!id || !qty) continue;
    m.set(id, Math.min(MAX_QTY_PER_LINE, (m.get(id) || 0) + qty));
  }
  return [...m.entries()].slice(0, MAX_LINES).map(([variant_id, qty]) => ({ variant_id, qty }));
}

export function variantLabel(v, lang) {
  const color = lang === 'ar' ? v.color_ar || v.color_en : v.color_en;
  return [color, v.opt].filter(Boolean).join(' · ');
}

/** Image for a variant: first image tagged with its color, else the first image. */
export function variantImage(images, colorEn) {
  if (!Array.isArray(images) || !images.length) return '';
  const m = colorEn ? images.find((i) => i.color && i.color === colorEn) : null;
  return (m || images[0]).url;
}

export function findCoupon(db, code) {
  if (!code) return null;
  return db.get('SELECT * FROM coupons WHERE code = ? COLLATE NOCASE', String(code).trim().slice(0, 40)) || null;
}

/** Returns null if the coupon can be used, otherwise an error code. */
export function couponProblem(db, c, subtotal, customerId) {
  if (!c || !c.active) return 'coupon_invalid';
  const now = isoNow();
  if (c.starts_at && c.starts_at > now) return 'coupon_not_started';
  if (c.ends_at && c.ends_at < now) return 'coupon_expired';
  if (c.usage_limit && c.used_count >= c.usage_limit) return 'coupon_used_up';
  if (c.min_subtotal && subtotal < c.min_subtotal) return 'coupon_min_subtotal';
  if (customerId && c.per_customer_limit) {
    const used = db.get(
      "SELECT COUNT(*) AS n FROM orders WHERE customer_id = ? AND coupon_code = ? COLLATE NOCASE AND status != 'cancelled'",
      customerId,
      c.code,
    ).n;
    if (used >= c.per_customer_limit) return 'coupon_used_up';
  }
  return null;
}

/**
 * Prices a cart.
 * input: { items:[{variant_id, qty}], coupon, zone, delivery_method: 'delivery'|'pickup' }
 */
export function quote(db, settings, input, { customerId = null, lang = 'en' } = {}) {
  const items = cleanItems(input.items);
  const lines = [];
  let subtotal = 0;
  let count = 0;
  let problems = 0;

  if (items.length) {
    const ids = items.map((i) => i.variant_id);
    const rows = db.all(
      `SELECT v.*, p.slug, p.name_en, p.name_ar, p.images, p.active, p.condition
       FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id IN (${ids.map(() => '?').join(',')})`,
      ...ids,
    );
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const it of items) {
      const v = byId.get(it.variant_id);
      if (!v || !v.active) {
        lines.push({ variant_id: it.variant_id, qty: it.qty, available: false, problem: 'unavailable' });
        problems++;
        continue;
      }
      const images = (() => {
        try {
          return JSON.parse(v.images);
        } catch {
          return [];
        }
      })();
      let problem = null;
      if (v.stock <= 0) problem = 'out_of_stock';
      else if (v.stock < it.qty) problem = 'not_enough_stock';
      const line = {
        variant_id: v.id,
        product_id: v.product_id,
        slug: v.slug,
        name: { en: v.name_en, ar: v.name_ar || v.name_en },
        variant: { en: variantLabel(v, 'en'), ar: variantLabel(v, 'ar') },
        color_hex: v.color_hex || '',
        sku: v.sku || '',
        image: variantImage(images, v.color_en),
        condition: v.condition,
        unit_price: v.price,
        compare_at: v.compare_at && v.compare_at > v.price ? v.compare_at : null,
        qty: it.qty,
        stock: Math.max(0, Math.min(v.stock, 25)),
        line_total: round2(v.price * it.qty),
        available: !problem,
        problem,
      };
      if (problem) problems++;
      else {
        subtotal += line.line_total;
        count += it.qty;
      }
      lines.push(line);
    }
  }
  subtotal = round2(subtotal);

  // Coupon
  let discount = 0;
  let coupon = null;
  let freeShippingCoupon = false;
  if (input.coupon) {
    const c = findCoupon(db, input.coupon);
    const problem = couponProblem(db, c, subtotal, customerId);
    if (problem) coupon = { code: String(input.coupon).trim().toUpperCase(), valid: false, problem, min_subtotal: c?.min_subtotal || 0 };
    else {
      if (c.type === 'percent') discount = round2((subtotal * Math.min(100, Math.max(0, c.value))) / 100);
      else if (c.type === 'fixed') discount = round2(Math.min(subtotal, Math.max(0, c.value)));
      else if (c.type === 'shipping') freeShippingCoupon = true;
      coupon = { code: c.code.toUpperCase(), valid: true, type: c.type, value: c.value };
    }
  }

  // Delivery
  const method = input.delivery_method === 'pickup' && settings.delivery.pickup_enabled ? 'pickup' : 'delivery';
  const zones = settings.delivery.zones || [];
  const zone = zones.find((z) => z.id === input.zone) || null;
  const afterDiscount = round2(subtotal - discount);
  const freeOver = Number(settings.delivery.free_over) || 0;
  const qualifiesFree = freeOver > 0 && afterDiscount >= freeOver;
  let deliveryFee = 0;
  if (method === 'delivery') {
    if (!count) deliveryFee = 0;
    else if (freeShippingCoupon || qualifiesFree) deliveryFee = 0;
    else deliveryFee = zone ? Number(zone.fee) || 0 : null; // null = choose a zone first
  }
  const total = round2(afterDiscount + (deliveryFee || 0));
  const rate = Number(settings.currency?.lbp_rate) || 0;

  return {
    lines,
    count,
    problems,
    subtotal,
    discount,
    coupon,
    delivery_method: method,
    zone: zone ? zone.id : null,
    delivery_fee: deliveryFee,
    free_delivery: method === 'delivery' && (qualifiesFree || freeShippingCoupon),
    free_delivery_over: freeOver,
    free_delivery_remaining: freeOver > 0 ? round2(Math.max(0, freeOver - afterDiscount)) : null,
    total,
    total_lbp: rate ? Math.round((total * rate) / 1000) * 1000 : null,
    lang,
  };
}

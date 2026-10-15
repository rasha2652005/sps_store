// Orders: checkout, status changes (with stock restore on cancel) and the shapes sent to customers/admins.
import { bad, conflict, notFound } from './errors.js';
import { quote } from './pricing.js';
import { paymentMethodsFor } from './settings.js';
import { bumpCatalog } from './schema.js';
import { isEmail, isoNow, normalizePhone, optStr, randomHex, round2, str, tx } from './util.js';

export const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'ready', 'delivered', 'cancelled'];
export const PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded'];

function nextOrderNumber(db) {
  const r = db.get('SELECT MAX(CAST(number AS INTEGER)) AS n FROM orders');
  return String(Math.max(1001, (r?.n || 1000) + 1));
}

/** Validates checkout input and returns a clean object (throws 400 with a field code on problems). */
export function validateCheckout(settings, body) {
  const c = body.customer || {};
  const d = body.delivery || {};
  const name = str(c.name, 80);
  if (name.length < 2) throw bad('name_required', 'Please enter your name', { field: 'name' });
  const phone = normalizePhone(c.phone);
  if (!phone) throw bad('phone_invalid', 'Please enter a valid phone number', { field: 'phone' });
  const email = optStr(c.email, 120);
  if (email && !isEmail(email)) throw bad('email_invalid', 'Please enter a valid email', { field: 'email' });

  const method = d.method === 'pickup' && settings.delivery.pickup_enabled ? 'pickup' : 'delivery';
  const out = {
    customer: { name, phone, email },
    delivery: { method, zone: null, city: null, street: null, building: null, floor: null, details: null },
    payment_method: String(body.payment_method || ''),
    payment_ref: optStr(body.payment_ref, 80),
    notes: optStr(body.notes, 500),
    lang: body.lang === 'ar' ? 'ar' : 'en',
    coupon: optStr(body.coupon, 40),
    save_address: !!body.save_address,
  };
  if (method === 'delivery') {
    const zone = (settings.delivery.zones || []).find((z) => z.id === d.zone);
    if (!zone) throw bad('zone_required', 'Please choose your area', { field: 'zone' });
    const city = str(d.city, 60);
    if (city.length < 2) throw bad('city_required', 'Please enter your city / town', { field: 'city' });
    const street = str(d.street, 120);
    if (street.length < 2) throw bad('street_required', 'Please enter your street', { field: 'street' });
    Object.assign(out.delivery, {
      zone: zone.id,
      city,
      street,
      building: optStr(d.building, 60),
      floor: optStr(d.floor, 20),
      details: optStr(d.details, 300),
    });
  }
  const allowed = paymentMethodsFor(settings, method);
  if (!allowed.includes(out.payment_method)) throw bad('payment_invalid', 'Please choose a payment method', { field: 'payment_method' });
  return out;
}

export function placeOrder(db, settings, body, { customer = null, isDemo = false } = {}) {
  const input = validateCheckout(settings, body);
  return tx(db, () => {
    const q = quote(
      db,
      settings,
      { items: body.items, coupon: input.coupon, zone: input.delivery.zone, delivery_method: input.delivery.method },
      { customerId: customer?.id || null, lang: input.lang },
    );
    if (!q.count && !q.problems) throw bad('cart_empty', 'Your cart is empty');
    if (q.problems) throw conflict('cart_changed', 'Some items in your cart changed', { lines: q.lines });
    if (input.coupon && !q.coupon?.valid) throw bad(q.coupon?.problem || 'coupon_invalid', 'This coupon cannot be used', { field: 'coupon' });
    if (q.delivery_method === 'delivery' && q.delivery_fee === null) throw bad('zone_required', 'Please choose your area', { field: 'zone' });

    const now = isoNow();
    const number = nextOrderNumber(db);
    const key = randomHex(12);
    const d = input.delivery;
    const res = db.run(
      `INSERT INTO orders (number, access_key, customer_id, status, delivery_method, payment_method, payment_status, payment_ref,
        subtotal, discount, delivery_fee, total, lbp_rate, coupon_code, customer_name, customer_phone, customer_email,
        zone, city, street, building, floor, address_details, notes, lang, is_demo, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', ?, ?, 'unpaid', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      number,
      key,
      customer?.id || null,
      d.method,
      input.payment_method,
      input.payment_ref,
      q.subtotal,
      q.discount,
      q.delivery_fee || 0,
      q.total,
      Number(settings.currency?.lbp_rate) || null,
      q.coupon?.valid ? q.coupon.code : null,
      input.customer.name,
      input.customer.phone,
      input.customer.email,
      d.zone,
      d.city,
      d.street,
      d.building,
      d.floor,
      d.details,
      input.notes,
      input.lang,
      isDemo ? 1 : 0,
      now,
      now,
    );
    const orderId = res.lastInsertRowid;
    for (const l of q.lines) {
      const upd = db.run('UPDATE variants SET stock = stock - ? WHERE id = ? AND stock >= ?', l.qty, l.variant_id, l.qty);
      if (!upd.changes) throw conflict('cart_changed', 'Some items in your cart changed', { lines: q.lines });
      db.run('UPDATE products SET sold_count = sold_count + ? WHERE id = ?', l.qty, l.product_id);
      db.run(
        `INSERT INTO order_items (order_id, product_id, variant_id, slug, name_en, name_ar, variant_en, variant_ar, sku, image, unit_price, qty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        orderId,
        l.product_id,
        l.variant_id,
        l.slug,
        l.name.en,
        l.name.ar,
        l.variant.en,
        l.variant.ar,
        l.sku,
        l.image,
        l.unit_price,
        l.qty,
      );
    }
    if (q.coupon?.valid) db.run('UPDATE coupons SET used_count = used_count + 1 WHERE code = ? COLLATE NOCASE', q.coupon.code);
    db.run('INSERT INTO order_events (order_id, status, note, actor, created_at) VALUES (?, ?, ?, ?, ?)', orderId, 'pending', null, 'customer', now);

    if (customer && input.save_address && d.method === 'delivery') {
      const same = db.get(
        'SELECT id FROM addresses WHERE customer_id = ? AND zone = ? AND city = ? AND street = ? AND IFNULL(building, \'\') = IFNULL(?, \'\')',
        customer.id,
        d.zone,
        d.city,
        d.street,
        d.building,
      );
      if (!same) {
        const hasDefault = db.get('SELECT id FROM addresses WHERE customer_id = ? AND is_default = 1', customer.id);
        db.run(
          'INSERT INTO addresses (customer_id, label, zone, city, street, building, floor, details, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          customer.id,
          null,
          d.zone,
          d.city,
          d.street,
          d.building,
          d.floor,
          d.details,
          hasDefault ? 0 : 1,
          now,
        );
      }
    }
    bumpCatalog(db);
    const order = orderFull(db, orderId, settings);
    return { ...order, key };
  });
}

function zoneName(settings, id) {
  const z = (settings.delivery.zones || []).find((x) => x.id === id);
  return z ? { en: z.en, ar: z.ar || z.en } : id ? { en: id, ar: id } : null;
}

/** Order with items + timeline. `admin` adds internal fields. */
export function orderFull(db, id, settings, { admin = false } = {}) {
  const o = db.get('SELECT * FROM orders WHERE id = ?', id);
  if (!o) throw notFound('order_not_found', 'Order not found');
  const items = db.all('SELECT * FROM order_items WHERE order_id = ? ORDER BY id', id).map((i) => ({
    id: i.id,
    product_id: i.product_id,
    variant_id: i.variant_id,
    slug: i.slug,
    name: { en: i.name_en, ar: i.name_ar || i.name_en },
    variant: { en: i.variant_en || '', ar: i.variant_ar || i.variant_en || '' },
    sku: i.sku || '',
    image: i.image,
    unit_price: i.unit_price,
    qty: i.qty,
    line_total: round2(i.unit_price * i.qty),
  }));
  // Event notes are messages the shop chose to show the customer; internal notes live in admin_notes.
  const events = db
    .all('SELECT status, note, actor, created_at FROM order_events WHERE order_id = ? ORDER BY id', id)
    .map((e) => (admin ? e : { status: e.status, note: e.note, created_at: e.created_at }));
  const out = {
    id: admin ? o.id : undefined,
    number: o.number,
    status: o.status,
    delivery_method: o.delivery_method,
    payment_method: o.payment_method,
    payment_status: o.payment_status,
    payment_ref: o.payment_ref,
    subtotal: o.subtotal,
    discount: o.discount,
    delivery_fee: o.delivery_fee,
    total: o.total,
    lbp_rate: o.lbp_rate,
    coupon_code: o.coupon_code,
    customer: { name: o.customer_name, phone: o.customer_phone, email: o.customer_email },
    address:
      o.delivery_method === 'delivery'
        ? { zone: o.zone, zone_name: zoneName(settings, o.zone), city: o.city, street: o.street, building: o.building, floor: o.floor, details: o.address_details }
        : null,
    notes: o.notes,
    lang: o.lang,
    items,
    events,
    can_cancel: o.status === 'pending',
    created_at: o.created_at,
    updated_at: o.updated_at,
  };
  if (admin) {
    out.admin_notes = o.admin_notes;
    out.customer_id = o.customer_id;
    out.is_demo = !!o.is_demo;
    out.events = db.all('SELECT status, note, actor, created_at FROM order_events WHERE order_id = ? ORDER BY id', id);
    if (o.customer_id) {
      const c = db.get('SELECT id, name, phone, email, created_at FROM customers WHERE id = ?', o.customer_id);
      if (c) {
        const s = db.get("SELECT COUNT(*) AS n, IFNULL(SUM(total), 0) AS spent FROM orders WHERE customer_id = ? AND status != 'cancelled'", c.id);
        out.account = { ...c, orders: s.n, spent: round2(s.spent) };
      }
    } else {
      const s = db.get("SELECT COUNT(*) AS n FROM orders WHERE customer_phone = ? AND status != 'cancelled'", o.customer_phone);
      out.phone_orders = s.n;
    }
  }
  return out;
}

function restoreStock(db, orderId, order) {
  for (const i of db.all('SELECT variant_id, product_id, qty FROM order_items WHERE order_id = ?', orderId)) {
    if (i.variant_id) db.run('UPDATE variants SET stock = stock + ? WHERE id = ?', i.qty, i.variant_id);
    if (i.product_id) db.run('UPDATE products SET sold_count = MAX(0, sold_count - ?) WHERE id = ?', i.qty, i.product_id);
  }
  if (order.coupon_code) db.run('UPDATE coupons SET used_count = MAX(0, used_count - 1) WHERE code = ? COLLATE NOCASE', order.coupon_code);
  bumpCatalog(db);
}

/** Admin update: status, payment status, internal notes. */
export function updateOrder(db, settings, id, patch, actorName) {
  return tx(db, () => {
    const o = db.get('SELECT * FROM orders WHERE id = ?', id);
    if (!o) throw notFound('order_not_found', 'Order not found');
    const now = isoNow();
    const note = optStr(patch.note, 300);
    let touched = false;

    if (patch.status && patch.status !== o.status) {
      if (!ORDER_STATUSES.includes(patch.status)) throw bad('status_invalid', 'Unknown status');
      if (o.status === 'cancelled') throw bad('order_closed', 'Cancelled orders cannot be reopened');
      db.run('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', patch.status, now, id);
      db.run('INSERT INTO order_events (order_id, status, note, actor, created_at) VALUES (?, ?, ?, ?, ?)', id, patch.status, note, actorName || 'admin', now);
      if (patch.status === 'cancelled') restoreStock(db, id, o);
      if (patch.status === 'delivered' && o.payment_status === 'unpaid' && ['cod', 'store'].includes(o.payment_method)) {
        db.run("UPDATE orders SET payment_status = 'paid' WHERE id = ?", id);
        db.run("INSERT INTO order_events (order_id, status, note, actor, created_at) VALUES (?, 'paid', NULL, ?, ?)", id, actorName || 'admin', now);
      }
      touched = true;
    } else if (note) {
      db.run('INSERT INTO order_events (order_id, status, note, actor, created_at) VALUES (?, ?, ?, ?, ?)', id, 'note', note, actorName || 'admin', now);
      touched = true;
    }
    if (patch.payment_status && patch.payment_status !== o.payment_status) {
      if (!PAYMENT_STATUSES.includes(patch.payment_status)) throw bad('payment_status_invalid', 'Unknown payment status');
      db.run('UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ?', patch.payment_status, now, id);
      db.run('INSERT INTO order_events (order_id, status, note, actor, created_at) VALUES (?, ?, NULL, ?, ?)', id, patch.payment_status, actorName || 'admin', now);
      touched = true;
    }
    if (patch.admin_notes !== undefined) {
      db.run('UPDATE orders SET admin_notes = ?, updated_at = ? WHERE id = ?', optStr(patch.admin_notes, 2000), now, id);
      touched = true;
    }
    return orderFull(db, id, settings, { admin: true });
  });
}

/** Customer cancels their own order while it is still pending. */
export function cancelByCustomer(db, settings, number, key) {
  return tx(db, () => {
    const o = db.get('SELECT * FROM orders WHERE number = ?', String(number));
    if (!o || o.access_key !== String(key || '')) throw notFound('order_not_found', 'Order not found');
    if (o.status !== 'pending') throw bad('order_not_cancellable', 'This order can no longer be cancelled');
    const now = isoNow();
    db.run("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?", now, o.id);
    db.run("INSERT INTO order_events (order_id, status, note, actor, created_at) VALUES (?, 'cancelled', ?, 'customer', ?)", o.id, 'Cancelled by customer', now);
    restoreStock(db, o.id, o);
    return orderFull(db, o.id, settings);
  });
}

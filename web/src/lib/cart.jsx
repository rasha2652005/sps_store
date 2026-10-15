// Shopping cart (saved in the browser) + live server pricing.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';

const KEY = 'sps:cart';
export const readJSON = (k, fallback) => {
  try {
    const v = JSON.parse(localStorage.getItem(k));
    return v ?? fallback;
  } catch {
    return fallback;
  }
};
export const writeJSON = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

const CartCtx = createContext(null);

/** Snapshot of a product variant for the cart (prices are re-checked by the server). */
export function lineFrom(product, variant) {
  const img = product.images?.find((i) => i.color && i.color === variant.color_en) || product.images?.[0];
  return {
    variant_id: variant.id,
    product_id: product.id,
    slug: product.slug,
    name: product.name,
    variant: {
      en: [variant.color_en, variant.opt].filter(Boolean).join(' · '),
      ar: [variant.color_ar || variant.color_en, variant.opt].filter(Boolean).join(' · '),
    },
    image: img?.url || '',
    price: variant.price,
    compare_at: variant.compare_at || null,
    color_hex: variant.color_hex || '',
    max: Math.min(10, Math.max(1, variant.stock || 1)),
    device: product.device || '',
    kind: product.category?.kind || '',
  };
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => readJSON(KEY, []).filter((x) => x && x.variant_id && x.qty > 0));
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(0);

  useEffect(() => writeJSON(KEY, items), [items]);
  useEffect(() => {
    const on = (e) => e.key === KEY && setItems(readJSON(KEY, []));
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, []);

  const add = useCallback((line, qty = 1) => {
    setItems((list) => {
      const i = list.findIndex((x) => x.variant_id === line.variant_id);
      if (i >= 0) {
        const next = [...list];
        next[i] = { ...next[i], ...line, qty: Math.min(line.max || 10, next[i].qty + qty) };
        return next;
      }
      return [...list, { ...line, qty: Math.min(line.max || 10, qty) }];
    });
    setBump((b) => b + 1);
    try {
      navigator.vibrate?.(12);
    } catch {
      /* not supported */
    }
  }, []);
  const setQty = useCallback((variantId, qty) => {
    setItems((list) => (qty <= 0 ? list.filter((x) => x.variant_id !== variantId) : list.map((x) => (x.variant_id === variantId ? { ...x, qty: Math.min(x.max || 10, qty) } : x))));
  }, []);
  const remove = useCallback((variantId) => setItems((list) => list.filter((x) => x.variant_id !== variantId)), []);
  const clear = useCallback(() => setItems([]), []);
  /** Updates snapshots from a server quote (new prices, stock limits, names). */
  const reconcile = useCallback((quote) => {
    if (!quote?.lines) return;
    setItems((list) => {
      let changed = false;
      const next = list.map((x) => {
        const l = quote.lines.find((q) => q.variant_id === x.variant_id);
        if (!l || l.unit_price === undefined) return x;
        const max = Math.max(1, Math.min(10, l.stock || 1));
        if (l.unit_price !== x.price || max !== x.max || l.image !== x.image) {
          changed = true;
          return { ...x, price: l.unit_price, compare_at: l.compare_at, max, image: l.image || x.image, name: l.name || x.name, variant: l.variant || x.variant };
        }
        return x;
      });
      return changed ? next : list;
    });
  }, []);

  const value = useMemo(() => {
    const count = items.reduce((s, x) => s + x.qty, 0);
    const subtotal = items.reduce((s, x) => s + x.price * x.qty, 0);
    return { items, count, subtotal, add, setQty, remove, clear, reconcile, open, setOpen, bump };
  }, [items, add, setQty, remove, clear, reconcile, open, bump]);
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export const useCart = () => useContext(CartCtx);

/** Live price quote from the server for the current cart. */
export function useQuote({ zone, delivery_method = 'delivery', coupon, enabled = true } = {}) {
  const { items, reconcile } = useCart();
  const [state, setState] = useState({ quote: null, loading: false, error: null });
  const payload = useMemo(
    () => JSON.stringify({ items: items.map((x) => ({ variant_id: x.variant_id, qty: x.qty })), zone, delivery_method, coupon }),
    [items, zone, delivery_method, coupon],
  );
  const seq = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true }));
    const timer = setTimeout(async () => {
      try {
        const q = await api('/api/cart/quote', { method: 'POST', body: JSON.parse(payload) });
        if (id !== seq.current) return;
        setState({ quote: q, loading: false, error: null });
        reconcile(q);
      } catch (e) {
        if (id === seq.current) setState((s) => ({ ...s, loading: false, error: e }));
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [payload, enabled, reconcile]);
  return state;
}

/** Animates a product image flying into the cart icon. */
export function flyToCart(img) {
  if (!img || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const targets = [...document.querySelectorAll('[data-cart-target]')].filter((el) => el.offsetParent !== null);
  const target = targets[0];
  if (!target) return;
  const a = img.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  if (!a.width) return;
  const clone = img.cloneNode(true);
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${a.left}px`,
    top: `${a.top}px`,
    width: `${a.width}px`,
    height: `${a.height}px`,
    zIndex: 120,
    pointerEvents: 'none',
    objectFit: 'contain',
    borderRadius: '18px',
    margin: 0,
  });
  document.body.appendChild(clone);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = clone.animate(
    [
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.25 - 90}px) scale(0.55)`, opacity: 0.95, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.08)`, opacity: 0.3 },
    ],
    { duration: 760, easing: 'cubic-bezier(0.55, 0, 0.35, 1)' },
  );
  anim.onfinish = () => clone.remove();
}

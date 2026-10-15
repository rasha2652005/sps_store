import { useEffect, useMemo, useState } from 'react';

const key = (s) => String(s || '').toLowerCase();

/** Color / option selection for a product with availability info. */
export function useVariantPicker(product, initial = {}) {
  const colors = product?.colors || [];
  const opts = product?.opts || [];
  const variants = product?.variants || [];

  const firstAvailable = useMemo(() => {
    if (!product) return {};
    const want = variants.find((v) => (!initial.color || key(v.color_en) === key(initial.color)) && (!initial.opt || key(v.opt) === key(initial.opt)) && v.stock > 0);
    const v = want || variants.find((x) => x.stock > 0) || variants[0];
    return { color: v?.color_en || '', opt: v?.opt || '' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  const [color, setColor] = useState(firstAvailable.color);
  const [opt, setOpt] = useState(firstAvailable.opt);

  useEffect(() => {
    setColor(firstAvailable.color);
    setOpt(firstAvailable.opt);
  }, [firstAvailable]);

  const find = (c, o) => variants.find((v) => key(v.color_en) === key(c) && key(v.opt) === key(o));
  const variant = find(color, opt) || null;
  const exists = (c, o) => !!find(c, o);
  const available = (c, o) => (find(c, o)?.stock || 0) > 0;

  const pickColor = (c) => {
    setColor(c);
    // keep the option if it exists for that color, else jump to one that does
    if (!exists(c, opt)) {
      const alt = variants.find((v) => key(v.color_en) === key(c) && v.stock > 0) || variants.find((v) => key(v.color_en) === key(c));
      if (alt) setOpt(alt.opt || '');
    }
  };
  const pickOpt = (o) => {
    setOpt(o);
    if (!exists(color, o)) {
      const alt = variants.find((v) => key(v.opt) === key(o) && v.stock > 0) || variants.find((v) => key(v.opt) === key(o));
      if (alt) setColor(alt.color_en || '');
    }
  };

  // Price of an option for the current color (for "+$200" labels)
  const optPrice = (o) => (find(color, o) || variants.find((v) => key(v.opt) === key(o)))?.price;
  const images = useMemo(() => {
    const all = product?.images || [];
    const mine = all.filter((i) => i.color && key(i.color) === key(color));
    const shared = all.filter((i) => !i.color);
    const list = mine.length ? [...mine, ...shared] : all;
    return list.length ? list : all;
  }, [product, color]);

  return { colors, opts, color, opt, variant, pickColor, pickOpt, available, exists, optPrice, images };
}

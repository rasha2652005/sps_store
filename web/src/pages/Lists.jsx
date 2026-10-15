import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeftRight, ArrowRight, Heart, Plus, ShoppingBag, X } from 'lucide-react';
import { useApi, qs } from '../lib/api.js';
import { useT } from '../lib/prefs.jsx';
import { useMoney } from '../lib/store.jsx';
import { useLists } from '../lib/account.jsx';
import { lineFrom, useCart } from '../lib/cart.jsx';
import { useTitle, useUI } from '../lib/ui.jsx';
import { Button, Empty, Img, Price, Stars, Switch, cx } from '../components/ui.jsx';
import { ProductGrid } from '../components/product/ProductCard.jsx';
import { CartLine, FreeDeliveryBar } from '../components/CartDrawer.jsx';

export function Wishlist() {
  const { t } = useT();
  const lists = useLists();
  useTitle(t('wishlist.title'));
  const ids = lists.wish.slice(0, 60);
  const { data, loading } = useApi(ids.length ? `/api/products${qs({ ids: ids.join(','), limit: 60 })}` : null);
  return (
    <div className="wrap animate-fade-in pt-8">
      <h1 className="mb-8 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {t('wishlist.title')} {ids.length > 0 && <span className="text-muted">({ids.length})</span>}
      </h1>
      {!ids.length ? (
        <Empty icon={Heart} title={t('wishlist.empty_title')} text={t('wishlist.empty_text')}>
          <Button to="/shop">{t('cart.start')}</Button>
        </Empty>
      ) : (
        <ProductGrid items={data?.items} loading={loading} count={Math.min(8, ids.length)} />
      )}
    </div>
  );
}

export function CartPage() {
  const { t } = useT();
  const m = useMoney();
  const cart = useCart();
  useTitle(t('cart.title'));
  return (
    <div className="wrap max-w-5xl animate-fade-in pt-8">
      <h1 className="mb-8 font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('cart.title')}</h1>
      {!cart.items.length ? (
        <Empty icon={ShoppingBag} title={t('cart.empty_title')} text={t('cart.empty_text')}>
          <Button to="/shop">{t('cart.start')}</Button>
        </Empty>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="card space-y-6 p-5 sm:p-7">
            {cart.items.map((l) => (
              <CartLine key={l.variant_id} line={l} />
            ))}
          </div>
          <div className="card space-y-4 p-6 lg:sticky lg:top-24">
            <FreeDeliveryBar subtotal={cart.subtotal} />
            <div className="flex items-baseline justify-between">
              <span className="text-muted">{t('cart.subtotal')}</span>
              <span dir="ltr" className="text-2xl font-bold tabular-nums">
                {m.fmt(cart.subtotal)}
              </span>
            </div>
            <p className="text-xs text-muted">
              {t('cart.delivery')}: {t('cart.delivery_later')}
            </p>
            <Button to="/checkout" size="lg" block iconEnd={ArrowRight}>
              {t('cart.checkout')}
            </Button>
            <p className="text-center text-xs text-muted">{t('cart.secure')}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function Compare() {
  const { t, L } = useT();
  const lists = useLists();
  const cart = useCart();
  const ui = useUI();
  const [diff, setDiff] = useState(false);
  useTitle(t('compare.title'));
  const ids = lists.compare;
  const { data } = useApi(ids.length ? `/api/products${qs({ ids: ids.join(','), limit: 4, full: 1 })}` : null);
  const items = data?.items || [];

  const rows = useMemo(() => {
    const specKeys = [];
    for (const p of items) for (const s of p.specs) if (!specKeys.includes(s.key)) specKeys.push(s.key);
    const label = (k) => {
      const x = t(`specs.${k}`);
      return x === `specs.${k}` ? k : x;
    };
    const base = [
      { key: 'brand', label: t('compare.brand'), get: (p) => p.brand?.name || '—' },
      { key: 'condition', label: t('compare.condition'), get: (p) => t(`conditions.${p.condition}`) },
      { key: 'opts', label: t('compare.options'), get: (p) => p.opts.join(' · ') || '—' },
      {
        key: 'colors',
        label: t('compare.colors'),
        get: (p) => p.colors.map((c) => c.en).join(','),
        render: (p) => (
          <div className="flex flex-wrap gap-1">
            {p.colors.map((c) => (
              <span key={c.en} title={L(c)} className="size-4 rounded-full border border-black/10" style={{ background: c.hex }} />
            ))}
          </div>
        ),
      },
      { key: 'rating', label: t('compare.rating'), get: (p) => (p.rating.count ? p.rating.avg : '—'), render: (p) => (p.rating.count ? <Stars value={p.rating.avg} /> : '—') },
    ];
    return [...base, ...specKeys.map((k) => ({ key: k, label: label(k), get: (p) => p.specs.find((s) => s.key === k)?.value || '—' }))];
  }, [items, t, L]);

  if (!ids.length)
    return (
      <div className="wrap pt-10">
        <Empty icon={ArrowLeftRight} title={t('compare.empty_title')} text={t('compare.empty_text')}>
          <Button to="/c/phones">{t('nav.phones')}</Button>
        </Empty>
      </div>
    );

  const visible = diff ? rows.filter((r) => new Set(items.map((p) => String(r.get(p)))).size > 1) : rows;
  const cols = `minmax(120px,0.8fr) repeat(${items.length}, minmax(180px,1fr))`;

  return (
    <div className="wrap animate-fade-in pt-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('compare.title')}</h1>
        <div className="flex items-center gap-4">
          <Switch checked={diff} onChange={setDiff} label={t('compare.differences')} />
          <Button variant="ghost" size="sm" onClick={lists.clearCompare}>
            {t('common.clear_all')}
          </Button>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <div className="min-w-fit">
          <div className="sticky top-0 grid border-b border-line bg-surface" style={{ gridTemplateColumns: cols }}>
            <div className="p-4 text-sm text-muted">{items.length < 4 && <button onClick={ui.openSearch} className="flex items-center gap-1.5 font-semibold hover:text-ink"><Plus className="size-4" /> {t('compare.add')}</button>}</div>
            {items.map((p) => {
              const single = p.variants.length === 1 && p.in_stock;
              return (
                <div key={p.id} className="relative border-s border-line p-4">
                  <button onClick={() => lists.toggleCompare(p.id)} className="absolute end-3 top-3 grid size-7 place-items-center rounded-full bg-surface-3 hover:bg-line" aria-label={t('common.delete')}>
                    <X className="size-3.5" />
                  </button>
                  <Link to={`/product/${p.slug}`}>
                    <Img thumb src={p.images[0]?.url} alt="" className="mx-auto aspect-square w-full max-w-[160px] rounded-2xl silver p-3" />
                    <p className="mt-3 line-clamp-2 font-semibold hover:underline">{L(p.name)}</p>
                  </Link>
                  <Price value={p.price_min} compareAt={p.compare_at} from={p.price_max > p.price_min} className="mt-1" />
                  <Button size="sm" variant={single ? 'primary' : 'outline'} className="mt-3 w-full" to={single ? undefined : `/product/${p.slug}`} onClick={single ? () => cart.add(lineFrom(p, p.variants[0]), 1) : undefined}>
                    {single ? t('product.add_to_cart') : t('product.choose')}
                  </Button>
                </div>
              );
            })}
          </div>
          {visible.map((r, k) => (
            <div key={r.key} className={cx('grid text-sm', k % 2 === 0 && 'bg-surface-2')} style={{ gridTemplateColumns: cols }}>
              <div className="p-4 font-semibold text-muted">{r.label}</div>
              {items.map((p) => (
                <div key={p.id} className="border-s border-line p-4" dir="auto">
                  {r.render ? r.render(p) : r.get(p)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

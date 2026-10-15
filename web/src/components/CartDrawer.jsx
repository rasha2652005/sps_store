import { Link } from 'react-router';
import { ArrowRight, Plus, ShoppingBag, Trash2, Truck, AlertTriangle } from 'lucide-react';
import { useApi, qs } from '../lib/api.js';
import { useT } from '../lib/prefs.jsx';
import { useMoney, useStore } from '../lib/store.jsx';
import { flyToCart, lineFrom, useCart, useQuote } from '../lib/cart.jsx';
import { useUI } from '../lib/ui.jsx';
import { Button, Drawer, Empty, Img, Price, Qty, cx } from './ui.jsx';

export function FreeDeliveryBar({ subtotal, className }) {
  const { t } = useT();
  const m = useMoney();
  const store = useStore();
  const over = Number(store.settings.delivery.free_over) || 0;
  if (!over || subtotal <= 0) return null;
  const left = Math.max(0, over - subtotal);
  const pct = Math.min(100, (subtotal / over) * 100);
  return (
    <div className={cx('rounded-2xl bg-surface-2 p-3.5', className)}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Truck className={cx('size-4', left ? 'text-muted' : 'text-ok')} />
        {left ? (
          <span>{t('cart.free_left', { amount: m.fmt(left) })}</span>
        ) : (
          <span className="text-ok">{t('cart.free_unlocked')}</span>
        )}
      </p>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line">
        <div className={cx('h-full rounded-full transition-all duration-700', left ? 'bg-ink' : 'bg-ok')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function CartLine({ line, problem, compact }) {
  const { t, L } = useT();
  const cart = useCart();
  return (
    <div className={cx('flex gap-3.5', problem && 'opacity-90')}>
      <Link to={`/product/${line.slug}`} className="shrink-0">
        <Img thumb src={line.image} alt="" className={cx('rounded-2xl silver p-1.5', compact ? 'size-16' : 'size-20')} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link to={`/product/${line.slug}`} className="line-clamp-2 text-sm font-semibold leading-snug hover:underline">
              {L(line.name)}
            </Link>
            {L(line.variant) && (
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                {line.color_hex && <span className="size-2.5 rounded-full border border-black/10" style={{ background: line.color_hex }} />}
                {L(line.variant)}
              </p>
            )}
          </div>
          <button onClick={() => cart.remove(line.variant_id)} className="-me-1 grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-3 hover:text-danger" aria-label={t('cart.remove')}>
            <Trash2 className="size-4" />
          </button>
        </div>
        {problem && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger">
            <AlertTriangle className="size-3.5" />
            {problem.problem === 'not_enough_stock' ? t('cart.not_enough', { count: problem.stock }) : problem.problem === 'out_of_stock' ? t('cart.out_of_stock') : t('cart.unavailable')}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <Qty size="sm" value={line.qty} max={line.max || 10} onChange={(n) => cart.setQty(line.variant_id, n)} />
          <Price value={line.price * line.qty} compareAt={line.compare_at ? line.compare_at * line.qty : null} size="sm" />
        </div>
      </div>
    </div>
  );
}

function Upsell() {
  const { t, L } = useT();
  const cart = useCart();
  const device = cart.items.find((x) => x.device && x.kind === 'phone')?.device;
  const { data } = useApi(device ? `/api/products${qs({ fits: device, limit: 8, in_stock: 1, kind: 'accessory' })}` : null);
  const inCart = new Set(cart.items.map((x) => x.product_id));
  const items = (data?.items || []).filter((p) => !inCart.has(p.id)).slice(0, 6);
  if (!device || !items.length) return null;
  return (
    <div className="border-t border-line px-5 py-4">
      <p className="mb-3 text-sm font-bold">{t('cart.complete')}</p>
      <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5">
        {items.map((p) => {
          const single = p.variants.length === 1;
          return (
            <div key={p.id} className="w-36 shrink-0">
              <Link to={`/product/${p.slug}`} className="relative block aspect-square rounded-2xl silver">
                <Img thumb src={p.images[0]?.url} alt="" className="absolute inset-0 p-3" />
              </Link>
              <p className="mt-2 line-clamp-1 text-xs font-semibold">{L(p.name)}</p>
              <div className="mt-1 flex items-center justify-between">
                <Price value={p.price_min} size="sm" />
                {single ? (
                  <button
                    className="grid size-7 place-items-center rounded-full bg-inverse text-on-inverse"
                    onClick={(e) => {
                      cart.add(lineFrom(p, p.variants[0]), 1);
                      flyToCart(e.currentTarget.closest('div')?.parentElement?.querySelector('img'));
                    }}
                    aria-label={t('product.add_to_cart')}
                  >
                    <Plus className="size-4" />
                  </button>
                ) : (
                  <Link to={`/product/${p.slug}`} className="grid size-7 place-items-center rounded-full bg-surface-3" aria-label={t('product.choose')}>
                    <ArrowRight className="size-3.5 rtl:-scale-x-100" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CartDrawer() {
  const { t } = useT();
  const cart = useCart();
  const m = useMoney();
  const { quote } = useQuote({ enabled: cart.open && cart.items.length > 0 });
  const problems = new Map((quote?.lines || []).filter((l) => l.problem).map((l) => [l.variant_id, l]));
  return (
    <Drawer
      open={cart.open}
      onClose={() => cart.setOpen(false)}
      title={
        <span className="flex items-center gap-2">
          {t('cart.title')} {cart.count > 0 && <span className="rounded-full bg-surface-3 px-2 text-sm text-muted">{cart.count}</span>}
        </span>
      }
      footer={
        cart.items.length > 0 && (
          <div className="space-y-3 p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted">{t('cart.subtotal')}</span>
              <span dir="ltr" className="text-xl font-bold tabular-nums">
                {m.fmt(cart.subtotal)}
              </span>
            </div>
            <p className="text-xs text-muted">{t('cart.secure')}</p>
            <Button to="/checkout" size="lg" block iconEnd={ArrowRight} onClick={() => cart.setOpen(false)}>
              {t('cart.checkout')}
            </Button>
            <button onClick={() => cart.setOpen(false)} className="w-full text-center text-sm font-semibold text-muted hover:text-ink">
              {t('cart.continue')}
            </button>
          </div>
        )
      }
    >
      {cart.items.length === 0 ? (
        <Empty icon={ShoppingBag} title={t('cart.empty_title')} text={t('cart.empty_text')}>
          <Button to="/shop" onClick={() => cart.setOpen(false)}>
            {t('cart.start')}
          </Button>
        </Empty>
      ) : (
        <>
          <div className="space-y-5 p-5">
            <FreeDeliveryBar subtotal={cart.subtotal} />
            {cart.items.map((l) => (
              <CartLine key={l.variant_id} line={l} problem={problems.get(l.variant_id)} />
            ))}
          </div>
          <Upsell />
        </>
      )}
    </Drawer>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Bell, Check, ShoppingBag, Zap } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useT } from '../../lib/prefs.jsx';
import { useMoney } from '../../lib/store.jsx';
import { flyToCart, lineFrom, useCart } from '../../lib/cart.jsx';
import { useToast } from '../../lib/toast.jsx';
import { Button, Input, Price, Qty, cx } from '../ui.jsx';

export function ColorPicker({ picker, size = 'md' }) {
  const { t, L } = useT();
  const { colors, color, pickColor, opts, opt, available } = picker;
  if (!colors.length) return null;
  const current = colors.find((c) => c.en === color);
  return (
    <div>
      <p className="mb-2.5 text-sm">
        <span className="font-semibold">{t('product.color')}:</span> <span className="text-muted">{current ? L(current) : ''}</span>
      </p>
      <div className="flex flex-wrap gap-2.5">
        {colors.map((c) => {
          const on = c.en === color;
          const any = opts.length ? opts.some((o) => available(c.en, o)) || available(c.en, opt) : available(c.en, '');
          return (
            <button
              key={c.en}
              type="button"
              onClick={() => pickColor(c.en)}
              title={L(c)}
              aria-label={L(c)}
              aria-pressed={on}
              className={cx(
                'relative grid place-items-center rounded-full transition',
                size === 'sm' ? 'size-9' : 'size-11',
                on ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : 'ring-1 ring-line-strong hover:ring-ink/50',
              )}
            >
              <span className={cx('rounded-full border border-black/10 shadow-inner', size === 'sm' ? 'size-7' : 'size-9')} style={{ background: c.hex }} />
              {!any && <span className="absolute h-px w-[70%] rotate-45 bg-muted" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function OptionPicker({ product, picker }) {
  const { t, L } = useT();
  const m = useMoney();
  const { opts, opt, color, pickOpt, available, exists, optPrice } = picker;
  if (!opts.length) return null;
  const base = optPrice(opts[0]);
  const label = L(product.opt_label) || t('specs.storage');
  return (
    <div>
      <p className="mb-2.5 text-sm font-semibold">{label}</p>
      <div className="flex flex-wrap gap-2">
        {opts.map((o) => {
          const on = o === opt;
          const ok = available(color, o);
          const there = exists(color, o);
          const price = optPrice(o);
          const diff = price - base;
          return (
            <button
              key={o}
              type="button"
              onClick={() => pickOpt(o)}
              aria-pressed={on}
              className={cx(
                'relative min-w-[84px] rounded-2xl border px-4 py-2.5 text-start transition',
                on ? 'border-ink bg-ink text-bg' : 'border-line-strong bg-surface hover:border-ink',
                !ok && !on && 'text-muted',
              )}
            >
              <span className={cx('block text-sm font-bold', !there && 'line-through opacity-60')} dir="ltr">
                {o}
              </span>
              {opts.length > 1 && price !== undefined && (
                <span dir="ltr" className={cx('block text-[11px]', on ? 'opacity-70' : 'text-muted')}>
                  {diff > 0 ? `+${m.fmt(diff)}` : m.fmt(price)}
                </span>
              )}
              {!ok && there && <span className={cx('absolute -top-2 end-2 rounded-full px-1.5 text-[9.5px] font-bold', on ? 'bg-hot text-white' : 'bg-surface-3 text-muted')}>{t('product.out_of_stock')}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StockLine({ variant }) {
  const { t } = useT();
  if (!variant) return null;
  if (variant.stock <= 0)
    return (
      <p className="flex items-center gap-2 text-sm font-semibold text-danger">
        <span className="size-2 rounded-full bg-danger" /> {t('product.out_of_stock')}
      </p>
    );
  if (variant.stock <= 3)
    return (
      <p className="flex items-center gap-2 text-sm font-semibold text-warn">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-warn opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-warn" />
        </span>
        {t('product.only_left', { count: variant.stock })}
      </p>
    );
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-ok">
      <Check className="size-4" /> {t('product.in_stock')}
    </p>
  );
}

export function NotifyMe({ product, variant }) {
  const { t } = useT();
  const [contact, setContact] = useState('');
  const [state, setState] = useState({ busy: false, done: false, error: '' });
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, done: false, error: '' });
    try {
      await api('/api/stock-alerts', { method: 'POST', body: { product_id: product.id, variant_id: variant?.id, contact } });
      setState({ busy: false, done: true, error: '' });
    } catch (err) {
      setState({ busy: false, done: false, error: t(`errors.${err.code}`) });
    }
  };
  if (state.done)
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-ok/10 p-4 text-sm font-medium text-ok">
        <Check className="mt-0.5 size-4 shrink-0" /> {t('product.notify_done')}
      </div>
    );
  return (
    <form onSubmit={submit} className="rounded-2xl border border-dashed border-line-strong p-4">
      <p className="flex items-center gap-2 font-semibold">
        <Bell className="size-4" /> {t('product.notify_title')}
      </p>
      <p className="mt-1 text-sm text-muted">{t('product.notify_text')}</p>
      <div className="mt-3 flex gap-2">
        <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={t('product.notify_placeholder')} error={state.error} className="flex-1" required />
        <Button type="submit" loading={state.busy} variant="primary">
          {t('product.notify_cta')}
        </Button>
      </div>
      {state.error && <p className="mt-2 text-xs text-danger">{state.error}</p>}
    </form>
  );
}

/** Price + pickers + quantity + buttons. Used on the product page and in quick view. */
export function PurchasePanel({ product, picker, compact, imageRef }) {
  const { t, L } = useT();
  const m = useMoney();
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const v = picker.variant;
  const price = v?.price ?? product.price_min;
  const compare = v?.compare_at ?? null;
  const ok = v && v.stock > 0;
  const max = Math.min(10, v?.stock || 1);

  const add = (buy) => {
    if (!ok) return;
    cart.add(lineFrom(product, v), qty);
    if (buy) return navigate('/checkout');
    const img = imageRef?.current?.querySelector('img');
    flyToCart(img);
    toast({
      title: t('product.added'),
      text: `${L(product.name)}${v.color_en || v.opt ? ` · ${[L({ en: v.color_en, ar: v.color_ar }), v.opt].filter(Boolean).join(' · ')}` : ''}`,
      image: img?.src,
      action: { label: t('cart.view_cart'), onClick: () => cart.setOpen(true) },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <Price value={price} compareAt={compare} size={compact ? 'lg' : 'xl'} />
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {compare > price && <span className="font-bold text-hot">{t('product.save', { amount: m.fmt(compare - price) })}</span>}
          {m.alt(price) && (
            <span dir="ltr" className="text-muted tabular-nums">
              ≈ {m.alt(price)}
            </span>
          )}
        </div>
      </div>
      <ColorPicker picker={picker} size={compact ? 'sm' : 'md'} />
      <OptionPicker product={product} picker={picker} />
      <StockLine variant={v} />
      {ok ? (
        <div className="flex flex-wrap items-center gap-3">
          <Qty value={qty} onChange={(n) => setQty(Math.max(1, n))} max={max} />
          <Button size="lg" icon={ShoppingBag} className="min-w-0 flex-1" onClick={() => add(false)}>
            {t('product.add_to_cart')}
          </Button>
          {!compact && (
            <Button size="lg" variant="outline" icon={Zap} className="w-full sm:w-auto" onClick={() => add(true)}>
              {t('product.buy_now')}
            </Button>
          )}
        </div>
      ) : (
        <NotifyMe product={product} variant={v} />
      )}
    </div>
  );
}

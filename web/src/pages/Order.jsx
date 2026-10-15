import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { Check, CircleX, Copy, MapPin, MessageCircle, Package, PackageCheck, Phone, Store, Truck, Wallet, Clock } from 'lucide-react';
import { api, qs, setCache, useApi } from '../lib/api.js';
import { useT } from '../lib/prefs.jsx';
import { useMoney, useStore, useWhatsApp } from '../lib/store.jsx';
import { useToast } from '../lib/toast.jsx';
import { useTitle } from '../lib/ui.jsx';
import { confetti } from '../lib/confetti.js';
import { absoluteUrl } from '../lib/links.js';
import { Badge, Button, Empty, Field, Img, Input, Modal, Skeleton, cx, useCopy } from '../components/ui.jsx';

export function OrderTimeline({ order }) {
  const { t, dateTime } = useT();
  const pickup = order.delivery_method === 'pickup';
  const steps = pickup ? ['pending', 'confirmed', 'ready', 'delivered'] : ['pending', 'confirmed', 'shipped', 'delivered'];
  const cancelled = order.status === 'cancelled';
  const idx = cancelled ? -1 : steps.indexOf(order.status);
  const when = (s) => order.events.find((e) => e.status === s)?.created_at;
  const icons = { pending: Clock, confirmed: Check, shipped: Truck, ready: Store, delivered: PackageCheck };
  if (cancelled)
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-danger/10 p-4 text-danger">
        <CircleX className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-bold">{t('order.statuses.cancelled')}</p>
          <p className="text-sm opacity-80">{t('order.status_text.cancelled')}</p>
        </div>
      </div>
    );
  return (
    <div>
      <ol className="relative grid grid-cols-4">
        {steps.map((s, k) => {
          const done = k <= idx;
          const Icon = icons[s];
          return (
            <li key={s} className="relative flex flex-col items-center text-center">
              {k > 0 && <span className={cx('absolute end-1/2 top-5 h-0.5 w-full -translate-y-1/2', k <= idx ? 'bg-ink' : 'bg-line')} />}
              <span className={cx('relative z-10 grid size-10 place-items-center rounded-full border-2 transition', done ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-faint', k === idx && 'ring-4 ring-ink/10')}>
                <Icon className="size-[18px]" />
              </span>
              <span className={cx('mt-2 text-xs font-bold sm:text-sm', !done && 'text-muted')}>{s === 'delivered' && pickup ? t('order.statuses.picked') : t(`order.statuses.${s}`)}</span>
              {when(s) && <span className="mt-0.5 hidden text-[11px] text-muted sm:block">{dateTime(when(s))}</span>}
            </li>
          );
        })}
      </ol>
      <p className="mt-6 rounded-2xl bg-surface-2 p-4 text-sm font-medium">{t(`order.status_text.${order.status}`)}</p>
    </div>
  );
}

export default function Order() {
  const { number } = useParams();
  const [sp] = useSearchParams();
  const key = sp.get('key') || '';
  const isNew = sp.get('new') === '1';
  const { t, L, date } = useT();
  const m = useMoney();
  const store = useStore();
  const wa = useWhatsApp();
  const toast = useToast();
  const [copy] = useCopy();
  const path = `/api/orders/${number}${qs({ key })}`;
  const { data, error } = useApi(path);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const fired = useRef(false);
  const o = data?.order;
  useTitle(o ? t('order.number', { number: o.number }) : t('order.track_title'));

  useEffect(() => {
    if (isNew && o && !fired.current) {
      fired.current = true;
      setTimeout(() => confetti(), 250);
    }
  }, [isNew, o]);

  if (error)
    return (
      <div className="wrap pt-10">
        <Empty icon={Package} title={t('errors.order_not_found')}>
          <Button to="/track">{t('order.track_title')}</Button>
        </Empty>
      </div>
    );
  if (!o)
    return (
      <div className="wrap max-w-3xl space-y-4 pt-10">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );

  const s = store.settings;
  const link = absoluteUrl(`/order/${o.number}?key=${o.key}`);
  const lines = o.items.map((i) => `• ${L(i.name)}${L(i.variant) ? ` (${L(i.variant)})` : ''} ×${i.qty} — ${m.usd(i.line_total)}`).join('\n');
  const waMsg = `${t('order.whatsapp_msg', { number: o.number })}\n\n${lines}\n\n${t('checkout.total')}: ${m.usd(o.total)}\n${o.customer.name} · ${o.customer.phone}\n${link}`;
  const transfer = ['whish', 'omt'].includes(o.payment_method) && o.payment_status === 'unpaid' && o.status !== 'cancelled';
  const cancel = async () => {
    setBusy(true);
    try {
      const r = await api(`/api/orders/${o.number}/cancel`, { method: 'POST', body: { key: o.key } });
      setCache(path, { order: { ...r.order, key: o.key } });
      toast({ title: t('order.cancelled_done'), tone: 'info' });
    } catch (e) {
      toast({ title: t(`errors.${e.code}`), tone: 'error' });
    } finally {
      setBusy(false);
      setConfirmCancel(false);
    }
  };

  return (
    <div className="wrap max-w-4xl animate-fade-in pt-8">
      {isNew && (
        <div className="mb-8 text-center">
          <span className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-ok text-white shadow-[0_12px_30px_-10px_var(--ok)]">
            <Check className="size-8" strokeWidth={2.5} />
          </span>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('order.thanks', { name: o.customer.name.split(' ')[0] })}</h1>
          <p className="mx-auto mt-2 max-w-md text-muted">{t('order.placed')}</p>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5 sm:p-7">
          <div>
            <h2 className="font-display text-2xl font-bold">{t('order.number', { number: o.number })}</h2>
            <p className="text-sm text-muted">{t('order.placed_on', { date: date(o.created_at) })}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={o.payment_status === 'paid' ? 'ok' : 'neutral'}>{t(`order.${o.payment_status}`)}</Badge>
            <Badge tone="outline">{t(`checkout.pay.${o.payment_method}`)}</Badge>
          </div>
        </div>
        <div className="p-5 sm:p-7">
          <OrderTimeline order={o} />
        </div>
      </div>

      {transfer && (
        <div className="card mt-4 border-ink/30 p-5 sm:p-7">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold">
            <Wallet className="size-5" /> {t('order.pay_title')}
          </h3>
          <p className="mt-2 text-sm text-ink-2">
            {t('order.pay_text', { amount: m.usd(o.total), method: t(`checkout.pay.${o.payment_method}`), number: s.payments[o.payment_method]?.account_number, name: s.payments[o.payment_method]?.account_name })}
          </p>
          {wa(waMsg) && (
            <Button href={wa(`${t('order.send_receipt')} — #${o.number}`)} target="_blank" rel="noreferrer" variant="whatsapp" icon={MessageCircle} className="mt-4">
              {t('order.send_receipt')}
            </Button>
          )}
        </div>
      )}

      {o.status !== 'cancelled' && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {wa(waMsg) && (
            <a href={wa(waMsg)} target="_blank" rel="noreferrer" className="card flex items-center gap-4 p-5 transition hover:border-wa">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-wa text-white">
                <MessageCircle className="size-6" />
              </span>
              <span>
                <span className="block font-bold">{t('order.send_whatsapp')}</span>
                <span className="block text-sm text-muted">{t('order.whatsapp_hint')}</span>
              </span>
            </a>
          )}
          {s.store.phone && (
            <a href={`tel:${s.store.phone.replace(/\s/g, '')}`} className="card flex items-center gap-4 p-5 transition hover:border-ink">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-inverse text-on-inverse">
                <Phone className="size-6" />
              </span>
              <span>
                <span className="block font-bold">{t('order.call')}</span>
                <span className="block text-sm text-muted" dir="ltr">
                  {s.store.phone}
                </span>
              </span>
            </a>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="card p-5 sm:p-7">
          <h3 className="mb-4 font-display text-lg font-bold">{t('order.items')}</h3>
          <div className="space-y-4">
            {o.items.map((i) => (
              <div key={i.id} className="flex items-center gap-3.5">
                <Link to={`/product/${i.slug}`}>
                  <Img thumb src={i.image} alt="" className="size-16 shrink-0 rounded-2xl silver p-1" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/product/${i.slug}`} className="line-clamp-1 font-semibold hover:underline">
                    {L(i.name)}
                  </Link>
                  <p className="text-xs text-muted">
                    {L(i.variant)}
                    {L(i.variant) ? ' · ' : ''}×{i.qty}
                  </p>
                </div>
                <span dir="ltr" className="font-semibold tabular-nums">
                  {m.fmt(i.line_total)}
                </span>
              </div>
            ))}
          </div>
          <dl className="mt-6 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">{t('common.subtotal')}</dt>
              <dd dir="ltr">{m.fmt(o.subtotal)}</dd>
            </div>
            {o.discount > 0 && (
              <div className="flex justify-between text-ok">
                <dt>
                  {t('checkout.discount')} {o.coupon_code && `(${o.coupon_code})`}
                </dt>
                <dd dir="ltr">−{m.fmt(o.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted">{t('checkout.delivery_fee')}</dt>
              <dd>{o.delivery_fee ? <span dir="ltr">{m.fmt(o.delivery_fee)}</span> : t('common.free')}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-bold">
              <dt>{t('checkout.total')}</dt>
              <dd dir="ltr">{m.fmt(o.total)}</dd>
            </div>
          </dl>
        </div>
        <div className="space-y-4">
          <div className="card p-5 sm:p-6">
            <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
              {o.address ? <MapPin className="size-5" /> : <Store className="size-5" />} {o.address ? t('order.address') : t('order.pickup')}
            </h3>
            {o.address ? (
              <div className="text-sm leading-relaxed text-ink-2">
                <p className="font-semibold text-ink">{o.customer.name}</p>
                <p dir="ltr" className="text-start">
                  {o.customer.phone}
                </p>
                <p>{[L(o.address.zone_name), o.address.city].filter(Boolean).join(' · ')}</p>
                <p>{[o.address.street, o.address.building, o.address.floor && `${t('checkout.floor')} ${o.address.floor}`].filter(Boolean).join(', ')}</p>
                {o.address.details && <p className="text-muted">{o.address.details}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted">
                {L(s.store, 'address')}
                <br />
                {t('order.pickup_text')}
              </p>
            )}
          </div>
          <div className="card p-5 sm:p-6">
            <p className="text-sm text-muted">{t('order.bookmark')}</p>
            <Button
              variant="secondary"
              size="sm"
              icon={Copy}
              className="mt-3"
              onClick={async () => {
                await copy(link);
                toast({ title: t('product.link_copied'), tone: 'info' });
              }}
            >
              {t('order.copy_link')}
            </Button>
          </div>
          {o.can_cancel && (
            <button onClick={() => setConfirmCancel(true)} className="w-full rounded-2xl py-3 text-sm font-semibold text-danger hover:bg-danger/5">
              {t('order.cancel')}
            </button>
          )}
        </div>
      </div>

      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title={t('order.cancel_confirm')}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
              {t('common.no')}
            </Button>
            <Button variant="danger" loading={busy} onClick={cancel}>
              {t('order.cancel')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted">{t('order.number', { number: o.number })}</p>
      </Modal>
    </div>
  );
}

export function Track() {
  const { t } = useT();
  const navigate = useNavigate();
  const [number, setNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState({ busy: false, error: '' });
  useTitle(t('order.track_title'));
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: '' });
    try {
      const r = await api('/api/orders/track', { method: 'POST', body: { number, phone } });
      navigate(`/order/${r.number}?key=${r.key}`);
    } catch (err) {
      setState({ busy: false, error: t(`errors.${err.code}`) });
    }
  };
  return (
    <div className="wrap max-w-lg animate-fade-in pt-12">
      <div className="card p-6 sm:p-9">
        <span className="mb-5 grid size-14 place-items-center rounded-2xl bg-inverse text-on-inverse">
          <Truck className="size-6" />
        </span>
        <h1 className="font-display text-3xl font-bold tracking-tight">{t('order.track_title')}</h1>
        <p className="mt-2 text-muted">{t('order.track_text')}</p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <Field label={t('order.track_number')}>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="1042" inputMode="numeric" required dir="ltr" />
          </Field>
          <Field label={t('order.track_phone')}>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="70 123 456" inputMode="tel" required dir="ltr" />
          </Field>
          {state.error && <p className="text-sm font-medium text-danger">{state.error}</p>}
          <Button type="submit" size="lg" block loading={state.busy}>
            {t('order.track_submit')}
          </Button>
        </form>
      </div>
    </div>
  );
}

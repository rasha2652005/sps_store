import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, Check, ChevronRight, Download, MapPin, MessageCircle, Phone, Printer, Search, Store, Truck, User, Wallet, X, PackageCheck, Ban } from 'lucide-react';
import { api, invalidate, qs, setCache, useApi } from '../lib/api.js';
import { translate, useT } from '../lib/prefs.jsx';
import { useMoney, useStore } from '../lib/store.jsx';
import { useToast } from '../lib/toast.jsx';
import { Badge, Button, Empty, Img, Input, Select, Skeleton, Tabs, Textarea, cx } from '../components/ui.jsx';
import { Lockup } from '../components/brand/Logo.jsx';
import { Confirm, PageHeader, Pager, Panel, PayBadge, StatusBadge, waTo } from './kit.jsx';

const TABS = ['open', 'pending', 'confirmed', 'shipped', 'ready', 'delivered', 'cancelled', 'all'];

export default function Orders() {
  const { t, ago, L } = useT();
  const m = useMoney();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const status = sp.get('status') || 'open';
  const page = Number(sp.get('page') || 1);
  const [q, setQ] = useState(sp.get('q') || '');
  const payment = sp.get('payment') || '';
  const unpaid = sp.get('unpaid') === '1';
  useEffect(() => {
    const id = setTimeout(() => {
      if ((sp.get('q') || '') !== q) update({ q: q || null, page: null });
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const update = (patch) => {
    const n = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) (v === null || v === '' ? n.delete(k) : n.set(k, v));
    setSp(n, { replace: true });
  };
  const params = { status: status === 'all' ? '' : status, q: sp.get('q') || '', payment, unpaid: unpaid ? '1' : '', page };
  const { data } = useApi(`/api/admin/orders${qs(params)}`, { ttl: 15000 });
  const counts = data?.counts || {};

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('admin.nav.orders')}
        subtitle={data ? t('admin.orders_count', { count: data.total }) : ''}
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={Download}
            {...(__DEMO__ ? { onClick: () => toast({ title: t('admin.demo_no_download'), tone: 'info' }) } : { href: `/api/admin/orders-export${qs({ ...params, page: undefined })}` })}
          >
            {t('admin.export_csv')}
          </Button>
        }
      />
      <Tabs
        value={status}
        onChange={(v) => update({ status: v === 'open' ? null : v, page: null })}
        items={TABS.map((s) => ({ value: s, label: s === 'all' ? t('admin.all') : s === 'open' ? t('admin.open_orders') : t(`order.statuses.${s}`), count: counts[s] ?? null }))}
        className="mb-4"
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admin.search_orders')} prefix={<Search className="size-4" />} />
        </div>
        <Select value={payment} onChange={(e) => update({ payment: e.target.value || null, page: null })} className="w-auto">
          <option value="">{t('admin.all_payments')}</option>
          {['cod', 'whish', 'omt', 'store'].map((p) => (
            <option key={p} value={p}>
              {t(`checkout.pay.${p}`)}
            </option>
          ))}
        </Select>
        <button onClick={() => update({ unpaid: unpaid ? null : '1', page: null })} className={cx('h-11 rounded-xl border px-4 text-sm font-semibold transition', unpaid ? 'border-ink bg-ink text-bg' : 'border-line-strong bg-surface hover:border-ink')}>
          {t('admin.unpaid_only')}
        </button>
      </div>
      <div className="card overflow-hidden">
        {!data ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : !data.items.length ? (
          <Empty icon={Search} title={t('admin.no_orders')} />
        ) : (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead className="border-b border-line bg-surface-2 text-start text-xs font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3 text-start">#</th>
                  <th className="px-4 py-3 text-start">{t('admin.customer')}</th>
                  <th className="px-4 py-3 text-start">{t('order.items')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.payment')}</th>
                  <th className="px-4 py-3 text-start">{t('order.status')}</th>
                  <th className="px-4 py-3 text-end">{t('checkout.total')}</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((o) => (
                  <tr key={o.id} className="group cursor-pointer transition hover:bg-surface-2" onClick={() => navigate(`/admin/orders/${o.id}`)}>
                    <td className="px-4 py-3">
                      <Link to={`/admin/orders/${o.id}`} className="font-mono font-bold hover:underline">
                        #{o.number}
                      </Link>
                      <p className="text-xs text-muted">{ago(o.created_at)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/admin/orders/${o.id}`} className="block">
                        <span className="block font-semibold">{o.customer_name}</span>
                        <span className="block text-xs text-muted" dir="ltr">
                          {o.customer_phone}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2 rtl:space-x-reverse">
                          {o.images.map((im, k) => (
                            <Img thumb key={k} src={im} alt="" className="size-9 rounded-lg border-2 border-surface silver p-0.5" />
                          ))}
                        </div>
                        <span className="text-xs text-muted">×{o.items}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block text-xs font-semibold">{t(`checkout.pay.${o.payment_method}`)}</span>
                      <PayBadge status={o.payment_status} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={o.status} pickup={o.delivery_method === 'pickup'} />
                      <p className="mt-1 text-xs text-muted">{o.delivery_method === 'pickup' ? t('order.pickup') : o.city}</p>
                    </td>
                    <td className="px-4 py-3 text-end font-bold tabular-nums" dir="ltr">
                      {m.usd(o.total)}
                    </td>
                    <td className="px-2">
                      <Link to={`/admin/orders/${o.id}`} className="grid size-8 place-items-center rounded-full text-muted group-hover:bg-surface-3" aria-label={t('admin.open')}>
                        <ChevronRight className="size-4 rtl:rotate-180" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="divide-y divide-line md:hidden">
              {data.items.map((o) => (
                <Link key={o.id} to={`/admin/orders/${o.id}`} className="flex items-center gap-3 p-4">
                  <Img thumb src={o.images[0]} alt="" className="size-12 shrink-0 rounded-xl silver p-1" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2">
                      <span className="font-mono font-bold">#{o.number}</span>
                      <StatusBadge status={o.status} pickup={o.delivery_method === 'pickup'} />
                    </p>
                    <p className="truncate text-sm">{o.customer_name}</p>
                    <p className="text-xs text-muted">
                      {ago(o.created_at)} · {t(`checkout.pay.${o.payment_method}`)}
                    </p>
                  </div>
                  <span className="font-bold" dir="ltr">
                    {m.usd(o.total)}
                  </span>
                </Link>
              ))}
            </div>
            <Pager page={data.page} pages={data.pages} onPage={(p) => update({ page: String(p) })} />
          </>
        )}
      </div>
    </div>
  );
}

const NEXT = {
  delivery: { pending: 'confirmed', confirmed: 'shipped', shipped: 'delivered' },
  pickup: { pending: 'confirmed', confirmed: 'ready', ready: 'delivered' },
};
const NEXT_ICON = { confirmed: Check, shipped: Truck, ready: Store, delivered: PackageCheck };

function Invoice({ o }) {
  const { L, date } = useT();
  const m = useMoney();
  const store = useStore();
  const s = store.settings.store;
  const tt = (k, v) => translate(o.lang || 'en', k, v);
  return (
    <div className="hidden bg-white p-8 text-black print:block">
      <div className="flex items-start justify-between border-b border-black/20 pb-6">
        <Lockup className="h-auto w-40 text-black" />
        <div className="text-end text-sm">
          <p className="text-2xl font-bold">INVOICE</p>
          <p>#{o.number}</p>
          <p>{date(o.created_at)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 py-6 text-sm">
        <div>
          <p className="font-bold">{s.name_en}</p>
          <p>{s.address_en}</p>
          <p dir="ltr">{s.phone}</p>
        </div>
        <div className="text-end">
          <p className="font-bold">{o.customer.name}</p>
          <p dir="ltr">{o.customer.phone}</p>
          {o.address && (
            <p>
              {[o.address.city, o.address.street, o.address.building].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/30 text-start">
            <th className="py-2 text-start">Item</th>
            <th className="py-2 text-center">Qty</th>
            <th className="py-2 text-end">Price</th>
            <th className="py-2 text-end">Total</th>
          </tr>
        </thead>
        <tbody>
          {o.items.map((i) => (
            <tr key={i.id} className="border-b border-black/10">
              <td className="py-2">
                {i.name.en} {i.variant.en && `(${i.variant.en})`}
                {i.sku && <span className="block text-xs text-black/50">{i.sku}</span>}
              </td>
              <td className="py-2 text-center">{i.qty}</td>
              <td className="py-2 text-end">{m.usd(i.unit_price)}</td>
              <td className="py-2 text-end">{m.usd(i.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ms-auto mt-4 w-64 space-y-1 text-sm">
        <p className="flex justify-between">
          <span>Subtotal</span>
          <span>{m.usd(o.subtotal)}</span>
        </p>
        {o.discount > 0 && (
          <p className="flex justify-between">
            <span>Discount</span>
            <span>−{m.usd(o.discount)}</span>
          </p>
        )}
        <p className="flex justify-between">
          <span>Delivery</span>
          <span>{m.usd(o.delivery_fee)}</span>
        </p>
        <p className="flex justify-between border-t border-black/30 pt-1 text-base font-bold">
          <span>Total</span>
          <span>{m.usd(o.total)}</span>
        </p>
        <p className="flex justify-between text-black/60">
          <span>Payment</span>
          <span>
            {tt(`checkout.pay.${o.payment_method}`)} · {o.payment_status}
          </span>
        </p>
      </div>
      <p className="mt-10 text-center text-xs text-black/50">{s.name_en} · Thank you!</p>
    </div>
  );
}

export function OrderDetail({ admin }) {
  const { id } = useParams();
  const { t, L, dateTime, date } = useT();
  const m = useMoney();
  const store = useStore();
  const toast = useToast();
  const path = `/api/admin/orders/${id}`;
  const { data, error } = useApi(path, { keep: false });
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const o = data?.order;
  useEffect(() => {
    if (o) setNotes(o.admin_notes || '');
  }, [o?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = async (body, label) => {
    setBusy(label || 'x');
    try {
      const r = await api(path, { method: 'PATCH', body });
      setCache(path, r);
      invalidate('/api/admin/orders?', '/api/admin/dashboard', '/api/admin/pulse');
      setNote('');
      toast({ title: t('admin.saved') });
      return r.order;
    } catch (e) {
      toast({ title: t(`admin.errors.${e.code}`) !== `admin.errors.${e.code}` ? t(`admin.errors.${e.code}`) : e.message, tone: 'error' });
    } finally {
      setBusy('');
    }
  };

  const tt = (key, vars) => translate(o?.lang || 'en', key, vars);
  const templates = useMemo(() => {
    if (!o) return [];
    const s = store.settings;
    const vars = {
      name: o.customer.name.split(' ')[0],
      number: o.number,
      total: m.usd(o.total),
      eta: o.lang === 'ar' ? s.delivery.eta_ar : s.delivery.eta_en,
      method: tt(`checkout.pay.${o.payment_method}`),
      account: s.payments[o.payment_method]?.account_number || '',
      account_name: s.payments[o.payment_method]?.account_name || '',
      store: s.store.name_en,
    };
    const list = [
      ['confirmed', 'wa_confirmed'],
      ['shipped', 'wa_shipped'],
      ['ready', 'wa_ready'],
      ['delivered', 'wa_delivered'],
    ].filter(([st]) => (o.delivery_method === 'pickup' ? st !== 'shipped' : st !== 'ready'));
    const out = list.map(([st, key]) => ({ key, label: t(`admin.wa.${key}_label`), text: tt(`admin.wa.${key}`, vars), status: st }));
    if (['whish', 'omt'].includes(o.payment_method) && o.payment_status === 'unpaid') out.unshift({ key: 'pay', label: t('admin.wa.wa_payment_label'), text: tt('admin.wa.wa_payment', vars) });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o, store]);

  if (error) return <Empty title={t('errors.order_not_found')} />;
  if (!o)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40" />
        <Skeleton className="h-72" />
      </div>
    );

  const flow = NEXT[o.delivery_method] || NEXT.delivery;
  const next = flow[o.status];
  const NextIcon = NEXT_ICON[next];
  const nextLabel = next ? t(`admin.next_step.${o.delivery_method === 'pickup' && next === 'delivered' ? 'picked' : next}`) : null;
  const pickup = o.delivery_method === 'pickup';
  const mapsQ = o.address ? encodeURIComponent([o.address.street, o.address.building, o.address.city, 'Lebanon'].filter(Boolean).join(', ')) : '';
  const currentTemplate = templates.find((x) => x.status === o.status) || templates[0];

  return (
    <div className="animate-fade-in">
      <div className="print:hidden">
        <Link to="/admin/orders" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="size-4 rtl:-scale-x-100" /> {t('admin.nav.orders')}
        </Link>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-3xl font-bold tracking-tight">#{o.number}</h1>
              <StatusBadge status={o.status} pickup={pickup} />
              <PayBadge status={o.payment_status} />
              {o.is_demo && <Badge tone="outline">demo</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted">
              {dateTime(o.created_at)} · {pickup ? t('order.pickup') : t('checkout.method_delivery')} · {t(`checkout.pay.${o.payment_method}`)} · {o.lang === 'ar' ? 'عربي' : 'English'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" icon={Printer} onClick={() => window.print()}>
              {t('admin.print')}
            </Button>
            <Button variant="outline" size="sm" icon={Phone} href={`tel:${o.customer.phone}`}>
              {t('admin.call')}
            </Button>
            {currentTemplate && (
              <Button variant="whatsapp" size="sm" icon={MessageCircle} href={waTo(o.customer.phone, currentTemplate.text)} target="_blank" rel="noreferrer">
                WhatsApp
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4">
            {o.status !== 'cancelled' && o.status !== 'delivered' && (
              <div className="card flex flex-wrap items-center gap-3 p-5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">{t('admin.next_action')}</p>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('admin.note_for_customer')} className="mt-2" />
                </div>
                {next && (
                  <Button size="lg" icon={NextIcon} loading={busy === 'next'} onClick={() => patch({ status: next, note }, 'next')}>
                    {nextLabel}
                  </Button>
                )}
                <Button variant="ghost" icon={Ban} className="text-danger" onClick={() => setConfirmCancel(true)}>
                  {t('admin.cancel_order')}
                </Button>
              </div>
            )}

            <Panel title={t('order.items')} pad={false}>
              <div className="divide-y divide-line">
                {o.items.map((i) => (
                  <div key={i.id} className="flex items-center gap-4 px-5 py-4">
                    <Img thumb src={i.image} alt="" className="size-16 shrink-0 rounded-2xl silver p-1" />
                    <div className="min-w-0 flex-1">
                      <Link to={i.product_id ? `/admin/products/${i.product_id}` : '#'} className="font-semibold hover:underline">
                        {L(i.name)}
                      </Link>
                      <p className="text-sm text-muted">{L(i.variant)}</p>
                      {i.sku && <p className="font-mono text-xs text-faint">{i.sku}</p>}
                    </div>
                    <span className="text-sm text-muted" dir="ltr">
                      {m.usd(i.unit_price)} × {i.qty}
                    </span>
                    <span className="w-20 text-end font-bold" dir="ltr">
                      {m.usd(i.line_total)}
                    </span>
                  </div>
                ))}
              </div>
              <dl className="space-y-1.5 border-t border-line px-5 py-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">{t('common.subtotal')}</dt>
                  <dd dir="ltr">{m.usd(o.subtotal)}</dd>
                </div>
                {o.discount > 0 && (
                  <div className="flex justify-between text-ok">
                    <dt>
                      {t('checkout.discount')} ({o.coupon_code})
                    </dt>
                    <dd dir="ltr">−{m.usd(o.discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted">{t('checkout.delivery_fee')}</dt>
                  <dd dir="ltr">{m.usd(o.delivery_fee)}</dd>
                </div>
                <div className="flex justify-between pt-2 text-lg font-bold">
                  <dt>{t('checkout.total')}</dt>
                  <dd dir="ltr">{m.usd(o.total)}</dd>
                </div>
                {o.lbp_rate > 0 && (
                  <div className="flex justify-between text-xs text-muted">
                    <dt>LBP @ {o.lbp_rate.toLocaleString('en-US')}</dt>
                    <dd dir="ltr">{(Math.round((o.total * o.lbp_rate) / 1000) * 1000).toLocaleString('en-US')} LBP</dd>
                  </div>
                )}
              </dl>
            </Panel>

            <Panel title={t('admin.timeline')}>
              <ol className="relative space-y-5 border-s-2 border-line ps-6">
                {[...o.events].reverse().map((e, k) => (
                  <li key={k} className="relative">
                    <span className={cx('absolute -start-[31px] top-1 size-3.5 rounded-full border-2 border-surface', k === 0 ? 'bg-ink' : 'bg-line-strong')} />
                    <p className="text-sm font-semibold">{t(`order.statuses.${e.status}`) !== `order.statuses.${e.status}` ? t(`order.statuses.${e.status}`) : e.status}</p>
                    <p className="text-xs text-muted">
                      {dateTime(e.created_at)} · {e.actor === 'customer' ? t('admin.customer') : e.actor}
                    </p>
                    {e.note && <p className="mt-1 rounded-xl bg-surface-2 px-3 py-2 text-sm">{e.note}</p>}
                  </li>
                ))}
              </ol>
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel title={t('admin.customer')}>
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-3">
                  <User className="size-5" />
                </span>
                <div className="min-w-0 text-sm">
                  <p className="font-bold">{o.customer.name}</p>
                  <p dir="ltr" className="text-start">
                    {o.customer.phone}
                  </p>
                  {o.customer.email && <p className="truncate text-muted">{o.customer.email}</p>}
                  {o.account ? (
                    <Link to={`/admin/customers/${o.account.id}`} className="mt-1 inline-block text-xs font-semibold underline">
                      {t('admin.account_orders', { count: o.account.orders })} · {m.usd(o.account.spent)}
                    </Link>
                  ) : (
                    <p className="mt-1 text-xs text-muted">
                      {t('admin.guest')} · {t('admin.orders_count', { count: o.phone_orders })}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="xs" variant="secondary" icon={Phone} href={`tel:${o.customer.phone}`}>
                  {t('admin.call')}
                </Button>
                <Button size="xs" variant="secondary" icon={MessageCircle} href={waTo(o.customer.phone)} target="_blank" rel="noreferrer">
                  WhatsApp
                </Button>
              </div>
            </Panel>

            <Panel title={pickup ? t('order.pickup') : t('order.address')}>
              {o.address ? (
                <div className="text-sm">
                  <p className="font-semibold">{L(o.address.zone_name)}</p>
                  <p>{o.address.city}</p>
                  <p>{[o.address.street, o.address.building, o.address.floor && `${t('checkout.floor')} ${o.address.floor}`].filter(Boolean).join(', ')}</p>
                  {o.address.details && <p className="mt-1 text-muted">{o.address.details}</p>}
                  <a href={`https://www.google.com/maps/search/?api=1&query=${mapsQ}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold underline">
                    <MapPin className="size-3.5" /> Google Maps
                  </a>
                </div>
              ) : (
                <p className="text-sm text-muted">{t('admin.pickup_note')}</p>
              )}
              {o.notes && (
                <div className="mt-4 rounded-xl bg-warn/10 p-3 text-sm">
                  <p className="text-xs font-bold text-warn">{t('checkout.notes')}</p>
                  <p className="mt-1">{o.notes}</p>
                </div>
              )}
            </Panel>

            <Panel title={t('admin.payment')}>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Wallet className="size-4 text-muted" /> {t(`checkout.pay.${o.payment_method}`)}
              </p>
              {o.payment_ref && (
                <p className="mt-1 text-sm text-muted">
                  {t('checkout.payment_ref')}: <span className="font-mono text-ink">{o.payment_ref}</span>
                </p>
              )}
              <div className="mt-3 flex gap-1.5">
                {['unpaid', 'paid', 'refunded'].map((s) => (
                  <button key={s} disabled={busy} onClick={() => s !== o.payment_status && patch({ payment_status: s })} className={cx('h-9 flex-1 rounded-xl border text-xs font-bold transition', o.payment_status === s ? 'border-ink bg-ink text-bg' : 'border-line-strong hover:border-ink')}>
                    {t(`order.${s}`)}
                  </button>
                ))}
              </div>
            </Panel>

            {templates.length > 0 && (
              <Panel title={t('admin.message_customer')}>
                <div className="space-y-2">
                  {templates.map((tp) => (
                    <a key={tp.key} href={waTo(o.customer.phone, tp.text)} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-sm transition hover:border-wa">
                      <MessageCircle className="size-4 shrink-0 text-wa" />
                      <span className="flex-1 font-semibold">{tp.label}</span>
                      <span className="text-xs text-muted">{o.lang === 'ar' ? 'AR' : 'EN'}</span>
                    </a>
                  ))}
                </div>
              </Panel>
            )}

            <Panel title={t('admin.internal_notes')}>
              <Textarea value={notes ?? ''} onChange={(e) => setNotes(e.target.value)} placeholder={t('admin.internal_notes_hint')} className="min-h-24" />
              {notes !== null && notes !== (o.admin_notes || '') && (
                <Button size="sm" className="mt-2" loading={busy === 'notes'} onClick={() => patch({ admin_notes: notes }, 'notes')}>
                  {t('common.save')}
                </Button>
              )}
            </Panel>
          </div>
        </div>
      </div>
      <Invoice o={o} />
      <Confirm
        open={confirmCancel}
        title={t('admin.cancel_order_q', { number: o.number })}
        text={t('admin.cancel_order_text')}
        confirmLabel={t('admin.cancel_order')}
        busy={busy === 'cancel'}
        onClose={() => setConfirmCancel(false)}
        onConfirm={async () => {
          await patch({ status: 'cancelled', note }, 'cancel');
          setConfirmCancel(false);
        }}
      />
    </div>
  );
}

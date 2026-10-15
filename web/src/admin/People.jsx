import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Ban, Bell, Check, KeyRound, MessageCircle, Phone, Search, Star, Trash2, Eye, EyeOff, Users, ArrowLeftRight, ShieldCheck } from 'lucide-react';
import { api, invalidate, qs, setCache, useApi } from '../lib/api.js';
import { useT } from '../lib/prefs.jsx';
import { useMoney } from '../lib/store.jsx';
import { useToast } from '../lib/toast.jsx';
import { absoluteUrl } from '../lib/links.js';
import { Badge, Button, Empty, IconButton, Img, Input, Modal, Segmented, Select, Skeleton, Stars, Tabs, cx, useCopy } from '../components/ui.jsx';
import { Confirm, PageHeader, Pager, Panel, StatusBadge, waTo } from './kit.jsx';

// ---------------------------------------------------------------- customers
export default function Customers() {
  const { t, date, ago } = useT();
  const m = useMoney();
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const id = setTimeout(() => {
      setTerm(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [q]);
  const { data } = useApi(`/api/admin/customers${qs({ q: term, page })}`);
  return (
    <div className="animate-fade-in">
      <PageHeader title={t('admin.nav.customers')} subtitle={data ? t('admin.customers_count', { count: data.total }) : ''} />
      <div className="mb-4 max-w-md">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admin.search_customers')} prefix={<Search className="size-4" />} />
      </div>
      <div className="card overflow-hidden">
        {!data ? (
          <Skeleton className="m-4 h-64" />
        ) : !data.items.length ? (
          <Empty icon={Users} title={t('admin.no_customers')} text={t('admin.no_customers_text')} />
        ) : (
          <>
            <div className="divide-y divide-line">
              {data.items.map((c) => (
                <Link key={c.id} to={`/admin/customers/${c.id}`} className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-surface-2">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-3 text-sm font-bold">{c.name.slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold">
                      {c.name} {c.blocked && <Badge tone="danger">{t('admin.blocked')}</Badge>}
                    </p>
                    <p className="text-xs text-muted">
                      <span dir="ltr">{c.phone}</span>
                      {c.email && ` · ${c.email}`}
                    </p>
                  </div>
                  <div className="hidden text-end text-xs text-muted sm:block">
                    <p>{t('admin.joined', { date: date(c.created_at) })}</p>
                    {c.last_order_at && <p>{t('admin.last_order', { when: ago(c.last_order_at) })}</p>}
                  </div>
                  <div className="w-24 text-end">
                    <p className="font-bold" dir="ltr">
                      {m.usd(c.spent)}
                    </p>
                    <p className="text-xs text-muted">{t('admin.orders_count', { count: c.orders })}</p>
                  </div>
                </Link>
              ))}
            </div>
            <Pager page={data.page} pages={data.pages} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

export function CustomerDetail() {
  const { id } = useParams();
  const { t, L, date } = useT();
  const m = useMoney();
  const toast = useToast();
  const [copy] = useCopy();
  const path = `/api/admin/customers/${id}`;
  const { data } = useApi(path, { keep: false });
  const [temp, setTemp] = useState(null);
  if (!data) return <Skeleton className="h-96" />;
  const c = data.customer;
  const block = async () => {
    const r = await api(path, { method: 'PATCH', body: { blocked: !c.blocked } });
    setCache(path, r);
    invalidate('/api/admin/customers?');
    toast({ title: t('admin.saved') });
  };
  const reset = async () => {
    const r = await api(`${path}/reset-password`, { method: 'POST', body: {} });
    setTemp(r.temp_password);
  };
  return (
    <div className="animate-fade-in">
      <Link to="/admin/customers" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4 rtl:-scale-x-100" /> {t('admin.nav.customers')}
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span className="grid size-14 place-items-center rounded-2xl bg-inverse font-display text-xl font-bold text-on-inverse">{c.name.slice(0, 1).toUpperCase()}</span>
        <div className="flex-1">
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
            {c.name} {c.blocked && <Badge tone="danger">{t('admin.blocked')}</Badge>}
          </h1>
          <p className="text-sm text-muted">
            <span dir="ltr">{c.phone}</span> {c.email && `· ${c.email}`} · {t('admin.joined', { date: date(c.created_at) })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" icon={Phone} href={`tel:${c.phone}`}>
            {t('admin.call')}
          </Button>
          <Button size="sm" variant="whatsapp" icon={MessageCircle} href={waTo(c.phone)} target="_blank" rel="noreferrer">
            WhatsApp
          </Button>
          <Button size="sm" variant="outline" icon={KeyRound} onClick={reset}>
            {t('admin.reset_password')}
          </Button>
          <Button size="sm" variant="ghost" icon={Ban} className={c.blocked ? '' : 'text-danger'} onClick={block}>
            {c.blocked ? t('admin.unblock') : t('admin.block')}
          </Button>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-muted">{t('admin.total_spent')}</p>
          <p className="mt-1 font-display text-2xl font-bold" dir="ltr">
            {m.usd(c.spent)}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-muted">{t('admin.nav.orders')}</p>
          <p className="mt-1 font-display text-2xl font-bold">{c.orders_count}</p>
        </div>
        <div className="card col-span-2 p-5 sm:col-span-1">
          <p className="text-sm text-muted">{t('admin.avg_order')}</p>
          <p className="mt-1 font-display text-2xl font-bold" dir="ltr">
            {m.usd(c.orders_count ? c.spent / c.orders_count : 0)}
          </p>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel title={t('admin.nav.orders')} pad={false}>
          {data.orders.length ? (
            <div className="divide-y divide-line">
              {data.orders.map((o) => (
                <Link key={o.id} to={`/admin/orders/${o.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2">
                  <span className="font-mono font-bold">#{o.number}</span>
                  <span className="flex-1 text-sm text-muted">{date(o.created_at)}</span>
                  <StatusBadge status={o.status} />
                  <span className="w-20 text-end font-bold" dir="ltr">
                    {m.usd(o.total)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="p-8 text-center text-sm text-muted">{t('admin.no_orders')}</p>
          )}
        </Panel>
        <Panel title={t('account.addresses')}>
          {data.addresses.length ? (
            <div className="space-y-3">
              {data.addresses.map((a) => (
                <div key={a.id} className="rounded-xl bg-surface-2 p-3 text-sm">
                  <p className="font-semibold">
                    {a.label || a.zone} {a.is_default ? <Badge tone="inverse">{t('account.default')}</Badge> : null}
                  </p>
                  <p className="text-muted">{[a.city, a.street, a.building, a.floor].filter(Boolean).join(', ')}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">{t('account.no_addresses')}</p>
          )}
        </Panel>
      </div>
      <Modal open={!!temp} onClose={() => setTemp(null)} title={t('admin.temp_password')} size="sm">
        <p className="text-sm text-muted">{t('admin.temp_password_text')}</p>
        <p className="my-4 rounded-2xl bg-surface-3 py-4 text-center font-mono text-2xl font-bold tracking-wider" dir="ltr">
          {temp}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              copy(temp);
              toast({ title: t('common.copied'), tone: 'info' });
            }}
          >
            {t('common.copy')}
          </Button>
          <Button variant="whatsapp" className="flex-1" icon={MessageCircle} href={waTo(c.phone, t('admin.temp_password_msg', { password: temp }))} target="_blank" rel="noreferrer">
            WhatsApp
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------- reviews
export function Reviews() {
  const { t, date } = useT();
  const [page, setPage] = useState(1);
  const [hidden, setHidden] = useState(false);
  const key = `/api/admin/reviews${qs({ page, hidden: hidden ? '1' : '' })}`;
  const { data, reload } = useApi(key);
  const [del, setDel] = useState(null);
  const act = async (r, body) => {
    await api(`/api/admin/reviews/${r.id}`, { method: 'PATCH', body });
    invalidate('/api/products');
    reload();
  };
  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('admin.nav.reviews')}
        subtitle={t('admin.reviews_text')}
        actions={<Segmented value={hidden ? 'h' : 'a'} onChange={(v) => setHidden(v === 'h')} options={[{ value: 'a', label: t('admin.all') }, { value: 'h', label: t('admin.hidden') }]} size="sm" />}
      />
      <div className="card overflow-hidden">
        {!data ? (
          <Skeleton className="m-4 h-48" />
        ) : !data.items.length ? (
          <Empty icon={Star} title={t('admin.no_reviews')} text={t('admin.no_reviews_text')} />
        ) : (
          <div className="divide-y divide-line">
            {data.items.map((r) => (
              <div key={r.id} className={cx('flex gap-4 px-5 py-4', r.hidden && 'opacity-60')}>
                <Img thumb src={r.image} alt="" className="size-14 shrink-0 rounded-xl silver p-1" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars value={r.rating} />
                    <span className="text-sm font-semibold">{r.author}</span>
                    {r.verified && (
                      <Badge tone="ok" icon={ShieldCheck}>
                        {t('product.verified')}
                      </Badge>
                    )}
                    <span className="text-xs text-muted">{date(r.created_at)}</span>
                  </div>
                  <Link to={`/product/${r.slug}`} target="_blank" className="text-xs text-muted hover:underline">
                    {r.name_en}
                  </Link>
                  {r.comment && <p className="mt-1.5 text-sm">{r.comment}</p>}
                </div>
                <div className="flex items-start gap-1">
                  <IconButton icon={r.hidden ? Eye : EyeOff} size="sm" label={r.hidden ? t('admin.show') : t('admin.hide')} onClick={() => act(r, { hidden: !r.hidden })} />
                  <IconButton icon={Trash2} size="sm" label={t('common.delete')} className="text-danger" onClick={() => setDel(r)} />
                </div>
              </div>
            ))}
          </div>
        )}
        {data && <Pager page={data.page} pages={data.pages} onPage={setPage} />}
      </div>
      <Confirm
        open={!!del}
        title={t('admin.delete_review_q')}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          await api(`/api/admin/reviews/${del.id}`, { method: 'DELETE' });
          setDel(null);
          reload();
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------- requests (trade-in + back in stock)
const TRADE_TONES = { new: 'warn', contacted: 'info', done: 'ok', rejected: 'neutral' };

function TradeIns() {
  const { t, ago } = useT();
  const [status, setStatus] = useState('');
  const key = `/api/admin/tradeins${qs({ status })}`;
  const { data } = useApi(key);
  const [offer, setOffer] = useState({});
  const update = async (r, body) => {
    const res = await api(`/api/admin/tradeins/${r.id}`, { method: 'PATCH', body });
    setCache('/api/admin/tradeins', res);
    invalidate('/api/admin/tradeins', '/api/admin/dashboard');
  };
  if (!data) return <Skeleton className="h-64" />;
  const counts = data.counts || {};
  return (
    <div>
      <Tabs
        value={status}
        onChange={setStatus}
        className="mb-4"
        items={[
          { value: '', label: t('admin.all') },
          ...['new', 'contacted', 'done', 'rejected'].map((s) => ({ value: s, label: t(`admin.trade.${s}`), count: counts[s] ?? null })),
        ]}
      />
      {!data.items.length ? (
        <Empty icon={ArrowLeftRight} title={t('admin.no_tradeins')} text={t('admin.no_tradeins_text')} className="card" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {data.items.map((r) => {
            const msg = t('admin.trade_msg', { name: r.name.split(' ')[0], device: r.device, offer: r.offer ? `$${r.offer}` : '…' });
            return (
              <div key={r.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-bold">
                      {r.device} {r.storage && <span className="text-muted">· {r.storage}</span>}
                    </p>
                    <p className="text-sm text-muted">
                      {r.name} · <span dir="ltr">{r.phone}</span> · {ago(r.created_at)}
                    </p>
                  </div>
                  <Badge tone={TRADE_TONES[r.status]}>{t(`admin.trade.${r.status}`)}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-surface-3 px-2.5 py-1 font-semibold">{t(`tradein.cond.${r.condition}`)}</span>
                  {r.battery != null && <span className="rounded-full bg-surface-3 px-2.5 py-1 font-semibold">🔋 {r.battery}%</span>}
                  {r.wants && (
                    <span className="rounded-full bg-surface-3 px-2.5 py-1 font-semibold">
                      → {r.wants}
                    </span>
                  )}
                </div>
                {r.notes && <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">{r.notes}</p>}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <label className="flex h-9 items-center rounded-xl border border-line-strong bg-surface px-2.5 text-sm text-muted transition focus-within:border-ink" dir="ltr">
                    $
                    <input
                      className="w-20 bg-transparent px-1 font-semibold text-ink outline-none placeholder:font-normal placeholder:text-faint"
                      placeholder={t('admin.offer')}
                      defaultValue={r.offer ?? ''}
                      onChange={(e) => setOffer({ ...offer, [r.id]: e.target.value })}
                      onBlur={(e) => e.target.value !== String(r.offer ?? '') && update(r, { offer: e.target.value })}
                    />
                  </label>
                  <Select value={r.status} onChange={(e) => update(r, { status: e.target.value })} className="h-9 w-auto text-sm font-semibold">
                    {['new', 'contacted', 'done', 'rejected'].map((s) => (
                      <option key={s} value={s}>
                        {t(`admin.trade.${s}`)}
                      </option>
                    ))}
                  </Select>
                  <span className="flex-1" />
                  <Button size="sm" variant="whatsapp" icon={MessageCircle} href={waTo(r.phone, msg)} target="_blank" rel="noreferrer" onClick={() => r.status === 'new' && update(r, { status: 'contacted' })}>
                    WhatsApp
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StockAlerts() {
  const { t, L, ago } = useT();
  const { data, reload } = useApi('/api/admin/stock-alerts');
  if (!data) return <Skeleton className="h-64" />;
  if (!data.items.length) return <Empty icon={Bell} title={t('admin.no_alerts')} text={t('admin.no_alerts_text')} className="card" />;
  const mark = async (a, notified) => {
    await api(`/api/admin/stock-alerts/${a.id}`, { method: 'PATCH', body: { notified } });
    reload();
    invalidate('/api/admin/dashboard');
  };
  return (
    <div className="card divide-y divide-line overflow-hidden">
      {data.items.map((a) => {
        const isPhone = a.contact.startsWith('+');
        const text = t('admin.alert_msg', { product: a.name_en, variant: a.variant ? ` (${a.variant})` : '', url: absoluteUrl(`/product/${a.slug}`) });
        return (
          <div key={a.id} className={cx('flex flex-wrap items-center gap-4 px-5 py-3.5', a.notified_at && 'opacity-55')}>
            <Img thumb src={a.image} alt="" className="size-12 shrink-0 rounded-xl silver p-1" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {L({ en: a.name_en, ar: a.name_ar })} {a.variant && <span className="font-normal text-muted">· {a.variant}</span>}
              </p>
              <p className="text-xs text-muted">
                <span dir="ltr">{a.contact}</span> · {ago(a.created_at)}
              </p>
            </div>
            {a.back_in_stock ? <Badge tone="ok">{t('admin.back_in_stock')}</Badge> : <Badge tone="neutral">{t('product.out_of_stock')}</Badge>}
            {isPhone ? (
              <Button size="sm" variant="whatsapp" icon={MessageCircle} href={waTo(a.contact, text)} target="_blank" rel="noreferrer" onClick={() => !a.notified_at && mark(a, true)}>
                {t('admin.notify')}
              </Button>
            ) : (
              <Button size="sm" variant="outline" href={`mailto:${a.contact}?subject=${encodeURIComponent(a.name_en)}&body=${encodeURIComponent(text)}`} onClick={() => !a.notified_at && mark(a, true)}>
                Email
              </Button>
            )}
            <IconButton icon={Check} size="sm" label={t('admin.mark_notified')} className={a.notified_at ? 'text-ok' : ''} onClick={() => mark(a, !a.notified_at)} />
          </div>
        );
      })}
    </div>
  );
}

export function Requests() {
  const { t } = useT();
  const [tab, setTab] = useState('tradeins');
  return (
    <div className="animate-fade-in">
      <PageHeader title={t('admin.nav.requests')} subtitle={t('admin.requests_text')} />
      <Segmented
        className="mb-5"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'tradeins', label: t('admin.tradeins'), icon: ArrowLeftRight },
          { value: 'alerts', label: t('admin.alerts'), icon: Bell },
        ]}
      />
      {tab === 'tradeins' ? <TradeIns /> : <StockAlerts />}
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Banknote, Clock, PackagePlus, Search, ShoppingCart, Truck, Users, Wallet, Inbox, Bell } from 'lucide-react';
import { api, invalidate, useApi } from '../lib/api.js';
import { useT } from '../lib/prefs.jsx';
import { useMoney } from '../lib/store.jsx';
import { useToast } from '../lib/toast.jsx';
import { Img, Segmented, Skeleton, cx } from '../components/ui.jsx';
import { Bar, Donut, PageHeader, Panel, SalesChart, Sparkline, STATUS_DOT, StatusBadge } from './kit.jsx';

function Kpi({ label, value, change, spark, icon: Icon }) {
  const up = change >= 0;
  return (
    <div className="card relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-muted">{label}</p>
        <span className="grid size-9 place-items-center rounded-xl bg-surface-3">
          <Icon className="size-[18px]" strokeWidth={1.8} />
        </span>
      </div>
      <p className="mt-2 font-display text-3xl font-bold tracking-tight" dir="ltr">
        {value}
      </p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className={cx('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold', up ? 'bg-ok/12 text-ok' : 'bg-danger/12 text-danger')} dir="ltr">
          {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
          {Math.abs(change)}%
        </span>
        {spark && <Sparkline values={spark} className="h-9 w-28 text-ink" />}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t, L, dateTime, ago } = useT();
  const m = useMoney();
  const toast = useToast();
  const [days, setDays] = useState(30);
  const { data, reload } = useApi(`/api/admin/dashboard?days=${days}`, { ttl: 20000 });

  if (!data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );

  const k = data.kpis;
  const rev = data.series.map((s) => s.revenue);
  const ord = data.series.map((s) => s.orders);
  const statusData = Object.entries(data.statuses).map(([key, value]) => ({ key, value, color: STATUS_DOT[key] || '#999' }));
  const totalStatus = statusData.reduce((s, d) => s + d.value, 0);
  const payTotal = Object.values(data.payments).reduce((s, p) => s + p.revenue, 0);
  const restock = async (variantId, add) => {
    try {
      const cur = data.low_stock.find((l) => l.variant_id === variantId);
      await api(`/api/admin/variants/${variantId}`, { method: 'PATCH', body: { stock: (cur?.stock || 0) + add } });
      toast({ title: t('admin.stock_updated') });
      invalidate('/api/admin/products', '/api/products', '/api/home');
      reload();
    } catch (e) {
      toast({ title: e.message, tone: 'error' });
    }
  };

  const actions = [
    { to: '/admin/orders?status=pending', icon: Clock, label: t('admin.dash.pending'), value: k.pending, tone: k.pending ? 'bg-warn text-white' : 'bg-surface-3' },
    { to: '/admin/orders?status=open', icon: Truck, label: t('admin.dash.to_deliver'), value: k.to_deliver, tone: 'bg-surface-3' },
    { to: '/admin/orders?unpaid=1', icon: Wallet, label: t('admin.dash.unpaid_transfers'), value: k.unpaid_transfers, tone: 'bg-surface-3' },
    { to: '/admin/requests', icon: Inbox, label: t('admin.dash.requests'), value: data.tradeins_new + data.alerts_waiting, tone: 'bg-surface-3' },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title={t('admin.dash.title')}
        subtitle={t('admin.dash.today', { revenue: m.usd(k.today.revenue), orders: k.today.orders })}
        actions={<Segmented value={days} onChange={setDays} options={[7, 30, 90].map((d) => ({ value: d, label: t('admin.dash.days', { count: d }) }))} />}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {actions.map((a) => (
          <Link key={a.to} to={a.to} className="card group flex items-center gap-3 p-3.5 transition hover:border-ink sm:gap-3.5 sm:p-4">
            <span className={cx('grid size-10 shrink-0 place-items-center rounded-2xl sm:size-11', a.tone)}>
              <a.icon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-2xl font-bold leading-none">{a.value}</span>
              <span className="mt-1 line-clamp-2 text-xs font-semibold leading-snug text-muted">{a.label}</span>
            </span>
            <ArrowRight className="hidden size-4 text-muted opacity-0 transition group-hover:opacity-100 sm:block rtl:-scale-x-100" />
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={t('admin.dash.revenue')} value={m.usd(k.revenue.value)} change={k.revenue.change} spark={rev} icon={Banknote} />
        <Kpi label={t('admin.dash.orders')} value={k.orders.value} change={k.orders.change} spark={ord} icon={ShoppingCart} />
        <Kpi label={t('admin.dash.aov')} value={m.usd(k.aov.value)} change={k.aov.change} icon={PackagePlus} />
        <Kpi label={t('admin.dash.customers')} value={k.customers.value} change={k.customers.change} icon={Users} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title={t('admin.dash.sales')} action={<span className="text-xs text-muted">{t('admin.dash.vs_prev', { count: days })}</span>}>
          <SalesChart series={data.series} money={m.usd} labelFor={(n) => t('admin.orders_count', { count: n })} />
        </Panel>
        <Panel title={t('admin.dash.by_status')}>
          {totalStatus ? (
            <div className="flex flex-col items-center gap-5">
              <Donut
                data={statusData}
                size={150}
                center={
                  <div>
                    <p className="font-display text-2xl font-bold">{totalStatus}</p>
                    <p className="text-[11px] text-muted">{t('admin.dash.orders')}</p>
                  </div>
                }
              />
              <div className="grid w-full grid-cols-2 gap-x-4 gap-y-2">
                {statusData.map((d) => (
                  <div key={d.key} className="flex items-center gap-2 text-xs">
                    <span className="size-2.5 rounded-full" style={{ background: d.color }} />
                    <span className="flex-1 text-muted">{t(`order.statuses.${d.key}`)}</span>
                    <span className="font-bold">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted">{t('admin.empty')}</p>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title={t('admin.dash.recent')} action={<Link to="/admin/orders" className="text-xs font-semibold text-muted hover:text-ink">{t('common.see_all')}</Link>} pad={false} className="xl:col-span-2">
          {data.recent.length ? (
            <div className="divide-y divide-line">
              {data.recent.map((o) => (
                <Link key={o.id} to={`/admin/orders/${o.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-surface-2">
                  <span className="w-14 font-mono text-sm font-bold">#{o.number}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{o.customer_name}</span>
                    <span className="block text-xs text-muted">
                      {ago(o.created_at)} · {t('admin.items_count', { count: o.items })}
                    </span>
                  </span>
                  <StatusBadge status={o.status} />
                  <span className="w-20 text-end text-sm font-bold tabular-nums" dir="ltr">
                    {m.usd(o.total)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="p-10 text-center text-sm text-muted">{t('admin.dash.no_orders')}</p>
          )}
        </Panel>
        <Panel title={t('admin.dash.payments')}>
          <div className="space-y-4">
            {['cod', 'whish', 'omt', 'store'].map((p) =>
              data.payments[p] ? (
                <div key={p}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="font-semibold">{t(`checkout.pay.${p}`)}</span>
                    <span className="text-muted" dir="ltr">
                      {m.usd(data.payments[p].revenue)} · {data.payments[p].count}
                    </span>
                  </div>
                  <Bar value={data.payments[p].revenue} max={payTotal} />
                </div>
              ) : null,
            )}
            {!payTotal && <p className="py-6 text-center text-sm text-muted">{t('admin.empty')}</p>}
          </div>
          {data.zones.length > 0 && (
            <>
              <p className="mb-3 mt-6 text-xs font-bold uppercase tracking-wider text-muted">{t('admin.dash.zones')}</p>
              <div className="space-y-2.5">
                {data.zones.map((z) => (
                  <div key={z.zone} className="flex items-center gap-3 text-sm">
                    <span className="w-28 truncate">{L(z.name)}</span>
                    <span className="flex-1">
                      <Bar value={z.revenue} max={data.zones[0].revenue} color="var(--muted)" />
                    </span>
                    <span className="w-8 text-end text-xs font-bold">{z.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title={t('admin.dash.top_products')} pad={false}>
          {data.top_products.length ? (
            <div className="divide-y divide-line">
              {data.top_products.map((p, i) => (
                <Link key={p.product_id} to={`/admin/products/${p.product_id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2">
                  <span className="w-4 text-xs font-bold text-muted">{i + 1}</span>
                  <Img thumb src={p.image} alt="" className="size-11 shrink-0 rounded-xl silver p-1" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{L(p.name)}</span>
                    <span className="block text-xs text-muted">{t('admin.sold', { count: p.qty })}</span>
                  </span>
                  <span className="text-sm font-bold" dir="ltr">
                    {m.usd(p.revenue)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="p-10 text-center text-sm text-muted">{t('admin.empty')}</p>
          )}
        </Panel>
        <Panel
          title={
            <span className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-warn" /> {t('admin.dash.low_stock')}
            </span>
          }
          pad={false}
        >
          {data.low_stock.length ? (
            <div className="divide-y divide-line">
              {data.low_stock.map((l) => (
                <div key={l.variant_id} className="flex items-center gap-3 px-5 py-3">
                  <Img thumb src={l.image} alt="" className="size-11 shrink-0 rounded-xl silver p-1" />
                  <Link to={`/admin/products/${l.product_id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold hover:underline">{L(l.name)}</span>
                    <span className="block truncate text-xs text-muted">{l.variant}</span>
                  </Link>
                  <span className={cx('rounded-full px-2 py-0.5 text-xs font-bold', l.stock === 0 ? 'bg-danger/12 text-danger' : 'bg-warn/14 text-warn')}>{l.stock}</span>
                  <button onClick={() => restock(l.variant_id, 5)} className="rounded-full bg-surface-3 px-2.5 py-1 text-xs font-bold hover:bg-line" title={t('admin.add_stock')}>
                    +5
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="p-10 text-center text-sm text-muted">{t('admin.dash.stock_ok')}</p>
          )}
        </Panel>
        <Panel
          title={
            <span className="flex items-center gap-2">
              <Search className="size-4" /> {t('admin.dash.searches')}
            </span>
          }
        >
          {data.searches.top.length ? (
            <div className="space-y-2">
              {data.searches.top.map((s) => (
                <div key={s.q} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate" dir="auto">
                    {s.q}
                  </span>
                  <span className="text-xs text-muted">×{s.n}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted">{t('admin.empty')}</p>
          )}
          {data.searches.zero.length > 0 && (
            <div className="mt-5 rounded-2xl bg-warn/10 p-4">
              <p className="flex items-center gap-2 text-xs font-bold text-warn">
                <Bell className="size-3.5" /> {t('admin.dash.not_found')}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.searches.zero.map((s) => (
                  <span key={s.q} className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold" dir="auto">
                    {s.q} <span className="text-muted">×{s.n}</span>
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted">{t('admin.dash.not_found_hint')}</p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

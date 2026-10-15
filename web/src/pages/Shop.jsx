import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { ChevronRight, SlidersHorizontal, X, Search as SearchIcon, Flame, Smartphone, Sparkles } from 'lucide-react';
import { useApi, qs } from '../lib/api.js';
import { useT } from '../lib/prefs.jsx';
import { useMoney, useStore } from '../lib/store.jsx';
import { useTitle, useUI } from '../lib/ui.jsx';
import { Button, Checkbox, Drawer, Empty, Select, Switch, cx } from '../components/ui.jsx';
import { CardSkeleton, ProductCard } from '../components/product/ProductCard.jsx';
import { categoryIcon } from '../components/icons.jsx';

const LIST_KEYS = ['brand', 'category', 'opt', 'color', 'condition'];

function useShopContext() {
  const { slug, device } = useParams();
  const location = useLocation();
  const path = location.pathname;
  if (path.startsWith('/c/')) return { mode: 'category', slug };
  if (path.startsWith('/b/')) return { mode: 'brand', slug };
  if (path.startsWith('/deals')) return { mode: 'deals' };
  if (path.startsWith('/used')) return { mode: 'used' };
  if (path.startsWith('/finder/')) return { mode: 'finder', device: decodeURIComponent(device || '') };
  if (path.startsWith('/search')) return { mode: 'search' };
  return { mode: 'all' };
}

function PriceFilter({ facets, params, setParam }) {
  const { t } = useT();
  const m = useMoney();
  const lo = facets.price.min;
  const hi = Math.max(facets.price.max, lo + 1);
  const [min, setMin] = useState(params.get('min') || '');
  const [max, setMax] = useState(params.get('max') || '');
  useEffect(() => {
    setMin(params.get('min') || '');
    setMax(params.get('max') || '');
  }, [params]);
  const a = Number(min || lo);
  const b = Number(max || hi);
  const commit = (x, y) => {
    setParam({ min: x && Number(x) > lo ? String(x) : null, max: y && Number(y) < hi ? String(y) : null });
  };
  const pct = (v) => ((v - lo) / (hi - lo)) * 100;
  return (
    <div>
      <div className="relative mx-2 mb-5 mt-3 h-1.5 rounded-full bg-line">
        <div className="absolute h-full rounded-full bg-ink" style={{ insetInlineStart: `${pct(Math.max(lo, a))}%`, insetInlineEnd: `${100 - pct(Math.min(hi, b))}%` }} />
        {[
          [a, (v) => setMin(String(Math.min(v, b - 1)))],
          [b, (v) => setMax(String(Math.max(v, a + 1)))],
        ].map(([val, set], k) => (
          <input
            key={k}
            type="range"
            min={lo}
            max={hi}
            value={Math.min(hi, Math.max(lo, val))}
            onChange={(e) => set(Number(e.target.value))}
            onPointerUp={() => commit(k === 0 ? min : a, k === 1 ? max : b)}
            onKeyUp={() => commit(min, max)}
            className="pointer-events-none absolute -top-2 h-5 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-ink [&::-moz-range-thumb]:bg-surface [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-ink [&::-webkit-slider-thumb]:bg-surface [&::-webkit-slider-thumb]:shadow"
            aria-label={k === 0 ? t('shop.min') : t('shop.max')}
          />
        ))}
      </div>
      <div className="flex items-center gap-2" dir="ltr">
        {[
          [min, setMin, lo, t('shop.min')],
          [max, setMax, hi, t('shop.max')],
        ].map(([v, set, ph, label], k) => (
          <label key={k} className="flex h-10 flex-1 items-center rounded-xl border border-line-strong bg-surface px-3 text-sm focus-within:border-ink">
            <span className="text-muted">$</span>
            <input
              inputMode="numeric"
              value={v}
              placeholder={String(ph)}
              aria-label={label}
              onChange={(e) => set(e.target.value.replace(/\D/g, ''))}
              onBlur={() => commit(min, max)}
              onKeyDown={(e) => e.key === 'Enter' && commit(min, max)}
              className="w-full min-w-0 bg-transparent ps-1 outline-none placeholder:text-faint"
            />
          </label>
        ))}
      </div>
      {m.currency === 'LBP' && <p className="mt-2 text-[11px] text-muted">USD</p>}
    </div>
  );
}

function FilterGroup({ title, children, open: initial = true }) {
  const [open, setOpen] = useState(initial);
  return (
    <div className="border-b border-line py-4 last:border-0">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-sm font-bold">
        {title}
        <ChevronRight className={cx('size-4 text-muted transition', open ? 'rotate-90' : 'rtl:rotate-180')} />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

function Filters({ facets, params, setParam, toggleIn, ctx }) {
  const { t, L } = useT();
  const has = (k, v) => (params.get(k) || '').split(',').includes(v);
  if (!facets) return null;
  return (
    <div>
      {ctx.mode !== 'category' && facets.categories.length > 1 && (
        <FilterGroup title={t('shop.filter.category')}>
          <div className="space-y-2.5">
            {facets.categories.map((c) => (
              <Checkbox key={c.slug} checked={has('category', c.slug)} onChange={() => toggleIn('category', c.slug)} label={<span className="flex flex-1 justify-between gap-2">{L(c.name)} <span className="text-xs text-muted">{c.count}</span></span>} className="w-full" />
            ))}
          </div>
        </FilterGroup>
      )}
      {ctx.mode !== 'brand' && facets.brands.length > 0 && (
        <FilterGroup title={t('shop.filter.brand')}>
          <div className="space-y-2.5">
            {facets.brands.map((b) => (
              <Checkbox key={b.slug} checked={has('brand', b.slug)} onChange={() => toggleIn('brand', b.slug)} label={<span className="flex flex-1 justify-between gap-2">{b.name} <span className="text-xs text-muted">{b.count}</span></span>} className="w-full" />
            ))}
          </div>
        </FilterGroup>
      )}
      <FilterGroup title={t('shop.filter.price')}>
        <PriceFilter facets={facets} params={params} setParam={setParam} />
      </FilterGroup>
      {facets.opts.length > 0 && (
        <FilterGroup title={t('shop.filter.storage')}>
          <div className="flex flex-wrap gap-2">
            {facets.opts.map((o) => (
              <button key={o.value} onClick={() => toggleIn('opt', o.value)} className={cx('h-9 rounded-full border px-3.5 text-sm font-semibold transition', has('opt', o.value) ? 'border-ink bg-ink text-bg' : 'border-line-strong hover:border-ink')} dir="ltr">
                {o.value}
              </button>
            ))}
          </div>
        </FilterGroup>
      )}
      {facets.colors.length > 0 && (
        <FilterGroup title={t('shop.filter.color')}>
          <div className="flex flex-wrap gap-2.5">
            {facets.colors.map((c) => (
              <button
                key={c.value}
                onClick={() => toggleIn('color', c.value)}
                title={t(`colors.${c.value}`)}
                className={cx('flex flex-col items-center gap-1 rounded-xl p-1 text-[11px] transition', has('color', c.value) ? 'bg-surface-3 font-bold' : 'text-muted hover:bg-surface-2')}
              >
                <span className={cx('size-8 rounded-full border border-black/10 shadow-inner', has('color', c.value) && 'ring-2 ring-ink ring-offset-2 ring-offset-surface')} style={{ background: c.hex }} />
                {t(`colors.${c.value}`)}
              </button>
            ))}
          </div>
        </FilterGroup>
      )}
      {ctx.mode !== 'used' && facets.conditions.length > 1 && (
        <FilterGroup title={t('shop.filter.condition')}>
          <div className="space-y-2.5">
            {facets.conditions.map((c) => (
              <Checkbox key={c.value} checked={has('condition', c.value)} onChange={() => toggleIn('condition', c.value)} label={<span className="flex flex-1 justify-between gap-2">{t(`conditions.${c.value}`)} <span className="text-xs text-muted">{c.count}</span></span>} className="w-full" />
            ))}
          </div>
        </FilterGroup>
      )}
      <FilterGroup title={t('shop.filter.availability')}>
        <div className="space-y-3">
          <Switch checked={params.get('in_stock') === '1'} onChange={(v) => setParam({ in_stock: v ? '1' : null })} label={t('shop.filter.in_stock')} />
          {ctx.mode !== 'deals' && <Switch checked={params.get('deals') === '1'} onChange={(v) => setParam({ deals: v ? '1' : null })} label={t('shop.filter.deals')} />}
        </div>
      </FilterGroup>
    </div>
  );
}

function Page({ base, page, onMeta, first }) {
  const { data, loading } = useApi(`/api/products${qs({ ...base, page, limit: 24, log: first && base.q ? '1' : undefined })}`);
  useEffect(() => {
    if (data && first) onMeta(data);
  }, [data, first, onMeta]);
  if (loading && !data) return Array.from({ length: first ? 8 : 4 }, (_, i) => <CardSkeleton key={`s${page}-${i}`} />);
  return data?.items.map((p, i) => <ProductCard key={p.id} p={p} eager={first && i < 4} />) || null;
}

export default function Shop() {
  const { t, L } = useT();
  const store = useStore();
  const ui = useUI();
  const ctx = useShopContext();
  const [params, setParams] = useSearchParams();
  const [pages, setPages] = useState(1);
  const [meta, setMeta] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const q = params.get('q') || '';

  const category = ctx.mode === 'category' ? store.categories.find((c) => c.slug === ctx.slug) : null;
  const brand = ctx.mode === 'brand' ? store.brands.find((b) => b.slug === ctx.slug) : null;

  const base = useMemo(() => {
    const o = {};
    for (const k of [...LIST_KEYS, 'min', 'max', 'in_stock', 'deals', 'sort']) if (params.get(k)) o[k] = params.get(k);
    if (q) o.q = q;
    if (ctx.mode === 'category') o.category = ctx.slug;
    if (ctx.mode === 'brand') o.brand = ctx.slug;
    if (ctx.mode === 'deals') o.deals = '1';
    if (ctx.mode === 'used') o.condition = params.get('condition') || 'used,refurbished';
    if (ctx.mode === 'finder') o.fits = ctx.device;
    return o;
  }, [params, q, ctx.mode, ctx.slug, ctx.device]);
  const baseKey = JSON.stringify(base);
  useEffect(() => {
    setPages(1);
  }, [baseKey]);
  const onMeta = useCallback((d) => setMeta({ ...d, key: baseKey }), [baseKey]);

  const setParam = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === '') next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };
  const toggleIn = (k, v) => {
    const cur = (params.get(k) || '').split(',').filter(Boolean);
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    setParam({ [k]: next.join(',') || null });
  };

  let title = t('shop.all');
  let subtitle = '';
  let icon = null;
  if (category) {
    title = L(category.name);
    icon = categoryIcon(category.icon);
  } else if (brand) title = brand.name;
  else if (ctx.mode === 'search') title = q ? t('shop.results_for', { q }) : t('shop.all');
  else if (ctx.mode === 'deals') {
    title = t('shop.deals_title');
    subtitle = t('shop.deals_text');
    icon = Flame;
  } else if (ctx.mode === 'used') {
    title = t('shop.used_title');
    subtitle = t('home.used_text');
    icon = Sparkles;
  } else if (ctx.mode === 'finder') {
    title = t('shop.accessories_for', { device: ctx.device });
    subtitle = t('shop.accessories_for_text', { device: ctx.device });
    icon = Smartphone;
  }
  useTitle(title);

  const active = [];
  for (const k of LIST_KEYS) {
    if (ctx.mode === 'category' && k === 'category') continue;
    if (ctx.mode === 'brand' && k === 'brand') continue;
    for (const v of (params.get(k) || '').split(',').filter(Boolean)) {
      let label = v;
      if (k === 'brand') label = store.brands.find((b) => b.slug === v)?.name || v;
      if (k === 'category') label = L(store.categories.find((c) => c.slug === v)?.name) || v;
      if (k === 'color') label = t(`colors.${v}`);
      if (k === 'condition') label = t(`conditions.${v}`);
      active.push({ k, v, label });
    }
  }
  if (params.get('min') || params.get('max')) active.push({ k: 'price', label: `$${params.get('min') || '0'} – $${params.get('max') || '∞'}` });
  if (params.get('in_stock')) active.push({ k: 'in_stock', label: t('shop.filter.in_stock') });
  if (params.get('deals') && ctx.mode !== 'deals') active.push({ k: 'deals', label: t('shop.filter.deals') });
  const removeChip = (c) => {
    if (c.k === 'price') setParam({ min: null, max: null });
    else if (c.k === 'in_stock' || c.k === 'deals') setParam({ [c.k]: null });
    else toggleIn(c.k, c.v);
  };
  const clearAll = () => {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (params.get('sort')) next.set('sort', params.get('sort'));
    setParams(next, { replace: true });
  };

  const total = meta && meta.key === baseKey ? meta.total : null;
  const sort = params.get('sort') || '';
  const shown = Math.min(total || 0, pages * 24);
  const chips = store.categories.filter((c) => c.count > 0);

  return (
    <div className="wrap animate-fade-in pt-6 sm:pt-8">
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted">
        <Link to="/" className="hover:text-ink">
          {t('nav.home')}
        </Link>
        <ChevronRight className="size-3 rtl:rotate-180" />
        <Link to="/shop" className="hover:text-ink">
          {t('nav.shop')}
        </Link>
        {ctx.mode !== 'all' && (
          <>
            <ChevronRight className="size-3 rtl:rotate-180" />
            <span className="truncate text-ink">{title}</span>
          </>
        )}
      </nav>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {icon && (
            <span className="hidden size-14 shrink-0 place-items-center rounded-2xl bg-inverse text-on-inverse sm:grid">
              {(() => {
                const I = icon;
                return <I className="size-6" strokeWidth={1.7} />;
              })()}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
            {subtitle ? <p className="mt-1 text-muted">{subtitle}</p> : total !== null && <p className="mt-1 text-sm text-muted">{t('shop.count', { count: total })}</p>}
          </div>
        </div>
        {ctx.mode === 'finder' && (
          <Link to="/finder" className="text-sm font-semibold underline underline-offset-4">
            {t('home.finder_choose')}
          </Link>
        )}
      </header>

      {(ctx.mode === 'all' || ctx.mode === 'search' || ctx.mode === 'category') && (
        <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:px-0">
          <Link to={q ? `/search${qs({ q })}` : '/shop'} className={cx('inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition', ctx.mode !== 'category' ? 'bg-inverse text-on-inverse' : 'bg-surface-3 hover:bg-line')}>
            {t('shop.all')}
          </Link>
          {chips.map((c) => {
            const I = categoryIcon(c.icon);
            const on = ctx.mode === 'category' && c.slug === ctx.slug;
            return (
              <Link key={c.id} to={`/c/${c.slug}`} className={cx('inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition', on ? 'bg-inverse text-on-inverse' : 'bg-surface-3 hover:bg-line')}>
                <I className="size-4" strokeWidth={1.8} /> {L(c.name)}
              </Link>
            );
          })}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pe-2">
            <Filters facets={meta?.facets} params={params} setParam={setParam} toggleIn={toggleIn} ctx={ctx} />
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" icon={SlidersHorizontal} className="lg:hidden" onClick={() => setDrawer(true)}>
              {t('common.filters')} {active.length > 0 && <span className="grid size-5 place-items-center rounded-full bg-ink text-[11px] text-bg">{active.length}</span>}
            </Button>
            <div className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto">
              {active.map((c) => (
                <button key={`${c.k}-${c.v || ''}`} onClick={() => removeChip(c)} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-surface-3 ps-3.5 pe-2.5 text-sm font-semibold hover:bg-line">
                  {c.label} <X className="size-3.5" />
                </button>
              ))}
              {active.length > 1 && (
                <button onClick={clearAll} className="h-9 shrink-0 px-2 text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline">
                  {t('common.clear_all')}
                </button>
              )}
            </div>
            <Select value={sort} onChange={(e) => setParam({ sort: e.target.value || null })} className="h-9 w-auto rounded-full text-sm" aria-label={t('common.sort')}>
              <option value="">{q ? t('shop.sort.relevance') : t('shop.sort.featured')}</option>
              {['newest', 'price_asc', 'price_desc', 'popular', 'discount'].map((s) => (
                <option key={s} value={s}>
                  {t(`shop.sort.${s}`)}
                </option>
              ))}
            </Select>
          </div>

          {meta?.suggestion && q && meta.total > 0 && meta.suggestion !== q.toLowerCase() && (
            <p className="mb-5 text-sm text-muted">
              {t('shop.did_you_mean')}{' '}
              <Link to={`/search${qs({ q: meta.suggestion })}`} className="font-bold text-ink underline">
                {meta.suggestion}
              </Link>
              ?
            </p>
          )}

          {total === 0 ? (
            <Empty icon={SearchIcon} title={t('shop.no_results')} text={t('shop.no_results_text')}>
              {meta?.correction && (
                <Button to={`/search${qs({ q: meta.correction })}`} variant="primary">
                  {t('shop.did_you_mean')}: {meta.correction}
                </Button>
              )}
              {active.length > 0 && (
                <Button variant="outline" onClick={clearAll}>
                  {t('common.clear_all')}
                </Button>
              )}
              <Button variant="outline" onClick={ui.openSearch} icon={SearchIcon}>
                {t('nav.search')}
              </Button>
            </Empty>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: pages }, (_, i) => (
                  <Page key={`${baseKey}-${i}`} base={base} page={i + 1} first={i === 0} onMeta={onMeta} />
                ))}
              </div>
              {total > shown && (
                <div className="mt-12 flex flex-col items-center gap-3">
                  <p className="text-sm text-muted">{t('shop.showing', { shown, total })}</p>
                  <div className="h-1 w-48 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-ink" style={{ width: `${(shown / total) * 100}%` }} />
                  </div>
                  <Button variant="outline" onClick={() => setPages((p) => p + 1)}>
                    {t('shop.load_more')}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        side="start"
        title={t('common.filters')}
        footer={
          <div className="flex gap-2 p-4">
            <Button variant="outline" className="flex-1" onClick={clearAll}>
              {t('common.clear_all')}
            </Button>
            <Button className="flex-[2]" onClick={() => setDrawer(false)}>
              {t('shop.show', { count: total ?? 0 })}
            </Button>
          </div>
        }
      >
        <div className="px-5">
          <Filters facets={meta?.facets} params={params} setParam={setParam} toggleIn={toggleIn} ctx={ctx} />
        </div>
      </Drawer>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, ArrowUpRight, Banknote, Clock, Compass, Flame, Gift, Phone, Repeat, ShieldCheck, Smartphone, Sparkles, Star, Truck, ArrowLeftRight } from 'lucide-react';
import { useApi, qs } from '../lib/api.js';
import { useT } from '../lib/prefs.jsx';
import { useStore, useMoney } from '../lib/store.jsx';
import { useLists } from '../lib/account.jsx';
import { useTitle } from '../lib/ui.jsx';
import { Button, Countdown, Img, SectionTitle, Skeleton, cx } from '../components/ui.jsx';
import { ProductGrid, ProductRail } from '../components/product/ProductCard.jsx';
import { categoryIcon } from '../components/icons.jsx';
import { Mark } from '../components/brand/Logo.jsx';

// ---------------------------------------------------------------- hero
function slideColor(s) {
  const c = s.product?.colors?.find((x) => x.en === s.color) || s.product?.colors?.[0];
  return c?.hex || '#9aa0aa';
}
function slideImage(s) {
  if (s.image) return s.image;
  const imgs = s.product?.images || [];
  return (imgs.find((i) => i.color === s.color) || imgs[0])?.url;
}

function Hero({ slides }) {
  const { t, L } = useT();
  const m = useMoney();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef(null);
  const list = slides.length ? slides : [null];
  const n = list.length;

  useEffect(() => {
    if (paused || n < 2) return;
    const id = setTimeout(() => setI((x) => (x + 1) % n), 7000);
    return () => clearTimeout(id);
  }, [i, paused, n]);

  const go = (d) => setI((x) => (x + d + n) % n);

  return (
    <section className="wrap pt-3 sm:pt-5">
      <div
        className="dark relative isolate overflow-hidden rounded-[30px] bg-[#09090b] text-white sm:rounded-[36px]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current == null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          const rtl = document.documentElement.dir === 'rtl';
          if (Math.abs(dx) > 50) go((dx < 0) !== rtl ? 1 : -1);
          touch.current = null;
        }}
      >
        <div className="panels pointer-events-none absolute inset-0 -z-10" />
        <div className="relative h-[640px] sm:h-[560px] lg:h-[580px]">
          {list.map((s, k) => {
            const active = k === i;
            const color = s ? slideColor(s) : '#9aa0aa';
            const img = s ? slideImage(s) : null;
            return (
              <div
                key={k}
                className={cx('absolute inset-0 transition-opacity duration-700', active ? 'z-10 opacity-100' : 'pointer-events-none z-0 opacity-0')}
                aria-hidden={!active}
              >
                {/* color glow taken from the phone's color */}
                <div
                  className="absolute -end-[10%] top-[38%] -z-10 size-[620px] -translate-y-1/2 rounded-full opacity-55 blur-[90px] transition-all duration-1000 sm:top-1/2 lg:end-[2%]"
                  style={{ background: `radial-gradient(circle, ${color} 0%, transparent 65%)` }}
                />
                <div className="grid h-full items-center gap-2 px-6 pb-16 pt-10 sm:px-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:px-16 lg:pb-12">
                  <div className={cx('relative z-10 max-w-xl transition-all delay-150 duration-700', active ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0')}>
                    {s ? (
                      <>
                        {L(s, 'eyebrow') && (
                          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs font-semibold backdrop-blur">
                            <span className="size-1.5 rounded-full" style={{ background: color }} />
                            {L(s, 'eyebrow')}
                          </span>
                        )}
                        <h1 className="mt-5 font-display text-[40px] font-bold leading-[1.02] tracking-tight text-balance sm:text-6xl lg:text-[68px]">{L(s, 'title')}</h1>
                        {L(s, 'subtitle') && <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/65 sm:text-lg">{L(s, 'subtitle')}</p>}
                        <div className="mt-7 flex flex-wrap items-center gap-3">
                          <Button to={s.link || '/shop'} variant="light" size="lg" iconEnd={ArrowRight}>
                            {L(s, 'cta') || t('home.shop_now')}
                          </Button>
                          {s.product && (
                            <span className="text-sm text-white/60">
                              {t('product.from')} <span dir="ltr" className="font-bold text-white">{m.fmt(s.product.price_min)}</span>
                              {s.product.compare_at > s.product.price_min && (
                                <span dir="ltr" className="ms-2 text-white/40 line-through">
                                  {m.fmt(s.product.compare_at)}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <Mark className="h-14 w-auto text-white" />
                        <h1 className="mt-6 font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl">{t('home.hero_fallback_title')}</h1>
                        <p className="mt-4 max-w-md text-lg text-white/65">{t('home.hero_fallback_text')}</p>
                        <Button to="/shop" variant="light" size="lg" iconEnd={ArrowRight} className="mt-7">
                          {t('home.shop_now')}
                        </Button>
                      </>
                    )}
                  </div>
                  <div className="relative -mt-4 flex h-full max-h-[330px] items-center justify-center sm:max-h-none lg:mt-0">
                    {img ? (
                      <Link to={s.link || '/shop'} className={cx('relative block aspect-square h-full max-h-[330px] transition-all duration-1000 ease-[var(--ease-out-expo)] sm:max-h-[420px] lg:max-h-[520px]', active ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-8 scale-95 opacity-0')}>
                        <Img src={img} alt={s.product ? L(s.product.name) : ''} eager={k === 0} className="size-full animate-float drop-shadow-[0_40px_60px_rgba(0,0,0,0.55)]" />
                      </Link>
                    ) : (
                      <Mark className="w-2/3 text-white/10" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {n > 1 && (
          <div className="absolute inset-x-6 bottom-6 z-20 flex items-center gap-2 sm:inset-x-12 lg:inset-x-16">
            {list.map((s, k) => (
              <button key={k} onClick={() => setI(k)} className="group relative h-8 flex-1 sm:max-w-[120px]" aria-label={`Slide ${k + 1}`}>
                <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-white/20">
                  <span
                    key={`${i}-${paused}`}
                    className={cx('block h-full rounded-full bg-white', k < i ? 'w-full' : k === i ? (paused ? 'w-full' : 'w-0 animate-[grow_7s_linear_forwards]') : 'w-0')}
                  />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- trust strip
const TRUST_ICONS = { truck: Truck, cash: Banknote, shield: ShieldCheck, swap: ArrowLeftRight, clock: Clock, star: Star, phone: Phone, gift: Gift };

function TrustStrip() {
  const { L } = useT();
  const store = useStore();
  const items = store.settings.home.trust || [];
  if (!items.length) return null;
  return (
    <section className="wrap mt-4">
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-4">
        {items.map((it, k) => {
          const Icon = TRUST_ICONS[it.icon] || ShieldCheck;
          return (
            <div key={k} className="card flex w-[78%] shrink-0 snap-start items-center gap-3.5 p-4 sm:w-auto">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-inverse text-on-inverse">
                <Icon className="size-5" strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">{L(it, 'title')}</span>
                <span className="block truncate text-xs text-muted">{L(it, 'text')}</span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- categories bento
function Categories({ images }) {
  const { t, L } = useT();
  const store = useStore();
  const cats = store.categories.filter((c) => c.count > 0);
  if (!cats.length) return null;
  const [big, ...rest] = cats;
  const mid = rest.slice(0, 4);
  const small = rest.slice(4);
  const Tile = ({ c, large }) => {
    const Icon = categoryIcon(c.icon);
    return (
      <Link
        to={`/c/${c.slug}`}
        className={cx(
          'group relative flex overflow-hidden rounded-[26px] border border-line transition duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]',
          large ? 'silver min-h-[300px] flex-col justify-between p-6 sm:p-8 lg:row-span-2' : 'silver min-h-[150px] flex-col justify-between p-5',
        )}
      >
        <span className="relative z-10">
          <span className={cx('grid place-items-center rounded-xl bg-surface shadow-[var(--shadow-soft)]', large ? 'size-11' : 'size-9')}>
            <Icon className={large ? 'size-5' : 'size-[18px]'} strokeWidth={1.8} />
          </span>
          <span className={cx('mt-4 block font-display font-bold tracking-tight', large ? 'text-3xl sm:text-4xl' : 'text-lg')}>{L(c.name)}</span>
          <span className="mt-1 block text-xs font-medium text-muted">{t('common.products', { count: c.count })}</span>
        </span>
        <span className="relative z-10 inline-flex items-center gap-1 text-sm font-semibold opacity-0 transition group-hover:opacity-100">
          {t('common.see_all')} <ArrowRight className="size-4 rtl:-scale-x-100" />
        </span>
        {images?.[c.slug] && (
          <Img
            thumb
            src={images[c.slug]}
            alt=""
            className={cx(
              'pointer-events-none absolute transition duration-700 ease-[var(--ease-out-expo)] group-hover:scale-110 group-hover:-rotate-3',
              large ? '-bottom-[6%] -end-[8%] size-[78%]' : '-bottom-[12%] -end-[10%] size-[64%]',
            )}
          />
        )}
      </Link>
    );
  };
  return (
    <section className="wrap mt-16 sm:mt-20">
      <SectionTitle eyebrow={t('home.categories_eyebrow')} title={t('home.categories_title')} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:grid-rows-2">
        <div className="col-span-2 lg:col-span-2 lg:row-span-2">
          <Tile c={big} large />
        </div>
        {mid.map((c) => (
          <Tile key={c.id} c={c} />
        ))}
      </div>
      {small.length > 0 && (
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:mt-4 sm:flex-wrap sm:px-0">
          {small.map((c) => {
            const Icon = categoryIcon(c.icon);
            return (
              <Link key={c.id} to={`/c/${c.slug}`} className="card flex shrink-0 items-center gap-2.5 py-2.5 pe-4 ps-2.5 transition hover:border-ink">
                <span className="grid size-9 place-items-center rounded-xl silver">
                  <Icon className="size-[18px]" strokeWidth={1.8} />
                </span>
                <span className="text-sm font-semibold">{L(c.name)}</span>
                <span className="text-xs text-muted">{c.count}</span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- deals
function Deals({ items, ends }) {
  const { t } = useT();
  if (!items?.length) return null;
  return (
    <section className="wrap mt-16 sm:mt-20">
      <div className="dark panels relative overflow-hidden rounded-[32px] bg-[#0b0b0d] px-4 py-8 text-white sm:px-8 sm:py-10 lg:px-10">
        <div className="pointer-events-none absolute -start-20 -top-32 size-96 rounded-full bg-hot/30 blur-[120px]" />
        <div className="relative mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-2 flex items-center gap-2 text-hot">
              <Flame className="size-4" /> {t('home.deals_eyebrow')}
            </p>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('home.deals_title')}</h2>
          </div>
          <div className="flex items-center gap-4">
            {ends && (
              <div className="flex items-center gap-3">
                <span className="hidden text-sm text-white/60 sm:inline">{t('home.deals_ends')}</span>
                <Countdown to={ends} dark />
              </div>
            )}
            <Button to="/deals" variant="glass" size="sm" iconEnd={ArrowRight}>
              {t('common.see_all')}
            </Button>
          </div>
        </div>
        <ProductRail items={items} dark />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- accessory finder
function Finder({ images }) {
  const { t } = useT();
  const store = useStore();
  const navigate = useNavigate();
  const devices = store.devices || [];
  const brands = useMemo(() => [...new Set(devices.map((d) => d.brand))], [devices]);
  const [brand, setBrand] = useState(brands[0] || '');
  const [device, setDevice] = useState('');
  useEffect(() => {
    if (!brand && brands[0]) setBrand(brands[0]);
  }, [brands, brand]);
  const list = devices.filter((d) => d.brand === brand);
  if (!devices.length) return null;
  return (
    <section className="wrap mt-16 sm:mt-20">
      <div className="card panels-light relative overflow-hidden p-6 sm:p-10 lg:p-12">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div>
            <p className="eyebrow flex items-center gap-2 text-muted">
              <Compass className="size-4" /> {t('home.finder_eyebrow')}
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">{t('home.finder_title')}</h2>
            <p className="mt-3 max-w-lg text-muted">{t('home.finder_text')}</p>
            <div className="mt-7">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{t('home.finder_brand')}</p>
              <div className="flex flex-wrap gap-2">
                {brands.map((b) => (
                  <button
                    key={b}
                    onClick={() => {
                      setBrand(b);
                      setDevice('');
                    }}
                    className={cx('h-10 rounded-full px-4 text-sm font-semibold transition', b === brand ? 'bg-inverse text-on-inverse' : 'bg-surface-3 hover:bg-line')}
                  >
                    {b}
                  </button>
                ))}
              </div>
              <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-muted">{t('home.finder_model')}</p>
              <div className="no-scrollbar flex max-h-[132px] flex-wrap gap-2 overflow-y-auto">
                {list.map((d) => (
                  <button
                    key={d.name}
                    onClick={() => setDevice(d.name)}
                    className={cx('inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition', d.name === device ? 'border-ink bg-ink text-bg' : 'border-line-strong hover:border-ink')}
                  >
                    <Smartphone className="size-3.5 opacity-60" /> {d.name}
                  </button>
                ))}
              </div>
              <Button className="mt-6" size="lg" iconEnd={ArrowRight} disabled={!device} onClick={() => navigate(`/finder/${encodeURIComponent(device)}`)}>
                {device ? t('home.finder_cta') : t('home.finder_choose')}
              </Button>
            </div>
          </div>
          <div className="relative hidden aspect-square lg:block">
            {['cases', 'chargers', 'screen-protection', 'power-banks'].map((slug, k) =>
              images?.[slug] ? (
                <div
                  key={slug}
                  className="absolute size-[52%] rounded-[28px] silver p-4 shadow-[var(--shadow-lift)] transition duration-700 hover:scale-105"
                  style={{ top: ['0%', '8%', '48%', '44%'][k], insetInlineStart: ['4%', '48%', '0%', '46%'][k], rotate: `${[-6, 5, 4, -5][k]}deg` }}
                >
                  <Img thumb src={images[slug]} alt="" className="size-full" />
                </div>
              ) : null,
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- trade-in + used
function TradeInBanner({ used }) {
  const { t } = useT();
  const store = useStore();
  return (
    <section className="wrap mt-16 grid gap-4 sm:mt-20 lg:grid-cols-2">
      {store.settings.tradein?.enabled !== false && (
        <Link to="/trade-in" className="dark panels group relative flex min-h-[300px] flex-col justify-between overflow-hidden rounded-[30px] bg-[#0b0b0d] p-7 text-white sm:p-10">
          <div className="pointer-events-none absolute -end-24 -top-24 size-80 rounded-full bg-white/10 blur-[100px]" />
          <div>
            <p className="eyebrow flex items-center gap-2 text-white/50">
              <ArrowLeftRight className="size-4" /> {t('home.tradein_eyebrow')}
            </p>
            <h3 className="mt-3 max-w-sm font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{t('home.tradein_title')}</h3>
            <p className="mt-3 max-w-sm text-white/60">{t('home.tradein_text')}</p>
          </div>
          <span className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-black transition group-hover:gap-3">
            {t('home.tradein_cta')} <ArrowRight className="size-4 rtl:-scale-x-100" />
          </span>
          <Repeat className="absolute -bottom-8 -end-6 size-56 text-white/[0.04]" strokeWidth={1.2} />
        </Link>
      )}
      {used?.length > 0 && (
        <Link to="/used" className="card group relative flex min-h-[300px] flex-col justify-between overflow-hidden p-7 sm:p-10">
          <div className="relative z-10">
            <p className="eyebrow flex items-center gap-2 text-muted">
              <Sparkles className="size-4" /> {t('home.used_eyebrow')}
            </p>
            <h3 className="mt-3 max-w-xs font-display text-3xl font-bold leading-tight tracking-tight">{t('home.used_title')}</h3>
            <p className="mt-3 max-w-[55%] text-sm text-muted sm:max-w-[16rem]">{t('home.used_text')}</p>
          </div>
          <span className="relative z-10 mt-6 inline-flex w-fit items-center gap-2 text-sm font-bold">
            {t('common.see_all')} <ArrowUpRight className="size-4" />
          </span>
          <Img thumb src={used[0].images[0]?.url} alt="" className="absolute -bottom-6 -end-6 size-[50%] transition duration-700 group-hover:scale-105 group-hover:-rotate-2 sm:size-[62%]" />
        </Link>
      )}
    </section>
  );
}

function Brands() {
  const { t } = useT();
  const store = useStore();
  if (!store.brands.length) return null;
  return (
    <section className="wrap mt-16 sm:mt-20">
      <SectionTitle eyebrow={t('home.brands_eyebrow')} title={t('home.brands_title')} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {store.brands.map((b) => (
          <Link key={b.id} to={`/b/${b.slug}`} className="card group flex h-28 flex-col items-center justify-center gap-1 transition hover:-translate-y-0.5 hover:border-ink hover:shadow-[var(--shadow-lift)]">
            <span className="font-display text-2xl font-bold tracking-tight">{b.name}</span>
            <span className="text-xs text-muted">{t('common.products', { count: b.count })}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Recent() {
  const { t } = useT();
  const { recent } = useLists();
  const { data } = useApi(recent.length ? `/api/products${qs({ ids: recent.slice(0, 10).join(','), limit: 10 })}` : null);
  if (!recent.length || !data?.items?.length) return null;
  return (
    <section className="wrap mt-16">
      <SectionTitle title={t('home.recent_title')} />
      <ProductRail items={data.items} />
    </section>
  );
}

export default function Home() {
  const { t } = useT();
  const store = useStore();
  const { data, loading } = useApi('/api/home', { ttl: 60000 });
  useTitle(null);
  useEffect(() => {
    document.title = `${store.settings.store.name_en} — ${store.settings.store.tagline_en}`;
  }, [store]);
  return (
    <div className="animate-fade-in">
      {data ? (
        <Hero slides={data.hero.filter((s) => s.product || s.image)} />
      ) : (
        <section className="wrap pt-3 sm:pt-5">
          <Skeleton className="h-[640px] rounded-[36px] sm:h-[560px] lg:h-[580px]" />
        </section>
      )}
      <TrustStrip />
      <Categories images={data?.category_images} />
      <Deals items={data?.deals} ends={data?.deals_end} />
      <section className="wrap mt-16 sm:mt-20">
        <SectionTitle
          eyebrow={t('home.new_eyebrow')}
          title={t('home.new_title')}
          action={
            <Link to="/c/phones" className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold hover:underline">
              {t('common.see_all')} <ArrowRight className="size-4 rtl:-scale-x-100" />
            </Link>
          }
        />
        <ProductRail items={data?.phones} loading={loading} />
      </section>
      <Finder images={data?.category_images} />
      <section className="wrap mt-16 sm:mt-20">
        <SectionTitle
          eyebrow={t('home.best_eyebrow')}
          title={t('home.best_title')}
          action={
            <Link to="/shop?sort=popular" className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold hover:underline">
              {t('common.see_all')} <ArrowRight className="size-4 rtl:-scale-x-100" />
            </Link>
          }
        />
        <ProductGrid items={data?.bestsellers} loading={loading} />
      </section>
      <TradeInBanner used={data?.used} />
      <section className="wrap mt-16 sm:mt-20">
        <SectionTitle eyebrow={t('home.accessories_eyebrow')} title={t('home.accessories_title')} />
        <ProductRail items={data?.accessories} loading={loading} />
      </section>
      <Brands />
      <Recent />
      <div className="wrap mt-16 flex justify-center">
        <Button to="/shop" variant="outline" size="lg" iconEnd={ArrowRight}>
          {t('home.explore')}
        </Button>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  ArrowLeftRight,
  BatteryFull,
  BatteryCharging,
  Camera,
  ChevronRight,
  Cpu,
  Droplets,
  Headphones,
  Heart,
  MessageCircle,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Store,
  Truck,
  Zap,
  Banknote,
  Star,
  Check,
} from 'lucide-react';
import { api, invalidate, useApi } from '../lib/api.js';
import { useT } from '../lib/prefs.jsx';
import { useMoney, useStore, useWhatsApp } from '../lib/store.jsx';
import { useAuth, useLists } from '../lib/account.jsx';
import { lineFrom, useCart, readJSON, writeJSON } from '../lib/cart.jsx';
import { useToast } from '../lib/toast.jsx';
import { useTitle } from '../lib/ui.jsx';
import { Badge, Button, Countdown, Empty, Img, Price, SectionTitle, Select, Skeleton, Stars, Textarea, cx, useCopy } from '../components/ui.jsx';
import { useVariantPicker } from '../components/product/variants.js';
import { PurchasePanel } from '../components/product/Purchase.jsx';
import { ProductBadges, ProductRail } from '../components/product/ProductCard.jsx';
import NotFound from './NotFound.jsx';

const HIGHLIGHT = [
  ['display', Smartphone],
  ['chip', Cpu],
  ['camera', Camera],
  ['battery', BatteryFull],
  ['battery_life', BatteryFull],
  ['capacity', BatteryCharging],
  ['power', Zap],
  ['anc', Headphones],
  ['water', Droplets],
];

function Gallery({ images, name, badges, imgRef }) {
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(null);
  const strip = useRef(null);
  useEffect(() => {
    setI(0);
    strip.current?.scrollTo({ left: 0 });
  }, [images]);
  const onScroll = () => {
    const el = strip.current;
    if (!el) return;
    setI(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
  };
  const goTo = (k) => {
    setI(k);
    const el = strip.current;
    if (el) el.scrollTo({ left: (document.documentElement.dir === 'rtl' ? -1 : 1) * k * el.clientWidth, behavior: 'smooth' });
  };
  return (
    <div className="lg:sticky lg:top-24">
      <div className="relative overflow-hidden rounded-[30px] silver" ref={imgRef}>
        <div ref={strip} onScroll={onScroll} className="no-scrollbar flex aspect-square snap-x snap-mandatory overflow-x-auto lg:overflow-hidden">
          {images.map((im, k) => (
            <div
              key={im.url + k}
              className="relative size-full shrink-0 snap-center overflow-hidden lg:cursor-zoom-in"
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
              }}
              onMouseLeave={() => setZoom(null)}
            >
              <Img
                src={im.url}
                alt={name}
                eager={k === 0}
                className="absolute inset-0 p-[7%]"
                imgClassName="transition-transform duration-300 ease-out"
                style={zoom && k === i ? { transform: 'scale(1.9)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
              />
            </div>
          ))}
        </div>
        {badges}
        {images.length > 1 && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5 lg:hidden">
            {images.map((_, k) => (
              <span key={k} className={cx('h-1.5 rounded-full transition-all', k === i ? 'w-5 bg-ink' : 'w-1.5 bg-ink/25')} />
            ))}
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div className="no-scrollbar mt-3 hidden gap-2.5 overflow-x-auto p-1 lg:flex">
          {images.map((im, k) => (
            <button key={im.url + k} onClick={() => goTo(k)} className={cx('size-20 shrink-0 overflow-hidden rounded-2xl silver p-1.5 transition', k === i ? 'ring-2 ring-ink' : 'opacity-70 hover:opacity-100')}>
              <Img thumb src={im.url} alt="" className="size-full" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DeliveryBox({ price }) {
  const { t, L } = useT();
  const m = useMoney();
  const store = useStore();
  const d = store.settings.delivery;
  const [zone, setZone] = useState(() => readJSON('sps:zone', d.zones[0]?.id));
  const z = d.zones.find((x) => x.id === zone) || d.zones[0];
  const free = d.free_over > 0 && price >= d.free_over;
  return (
    <div className="divide-y divide-line rounded-3xl border border-line">
      <div className="flex items-center gap-3 p-4">
        <Truck className="size-5 shrink-0 text-muted" strokeWidth={1.8} />
        <div className="min-w-0 flex-1 text-sm">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="font-semibold">{t('product.delivery_to')}</span>
            <select
              value={z?.id}
              onChange={(e) => {
                setZone(e.target.value);
                writeJSON('sps:zone', e.target.value);
              }}
              className="cursor-pointer appearance-none rounded-lg bg-transparent font-semibold underline decoration-dotted underline-offset-4 outline-none"
            >
              {d.zones.map((x) => (
                <option key={x.id} value={x.id}>
                  {L(x)}
                </option>
              ))}
            </select>
          </div>
          <p className="text-muted">
            {free ? <span className="font-semibold text-ok">{t('common.free')}</span> : <span dir="ltr">{m.fmt(z?.fee || 0)}</span>} · {L(d, 'eta')}
          </p>
        </div>
      </div>
      {d.free_over > 0 && !free && (
        <div className="flex items-center gap-3 p-4 text-sm">
          <Check className="size-5 shrink-0 text-muted" strokeWidth={1.8} />
          <span>{t('product.free_over', { amount: m.fmt(d.free_over) })}</span>
        </div>
      )}
      <div className="flex items-center gap-3 p-4 text-sm">
        <Banknote className="size-5 shrink-0 text-muted" strokeWidth={1.8} />
        <span>{t('product.cod')}</span>
      </div>
      {d.pickup_enabled && (
        <div className="flex items-center gap-3 p-4 text-sm">
          <Store className="size-5 shrink-0 text-muted" strokeWidth={1.8} />
          <span>{t('product.pickup')}</span>
        </div>
      )}
    </div>
  );
}

function Reviews({ product, distribution }) {
  const { t, date } = useT();
  const auth = useAuth();
  const toast = useToast();
  const { data, reload } = useApi(`/api/products/${product.slug}/reviews`);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (data?.mine) {
      setRating(data.mine.rating);
      setComment(data.mine.comment || '');
    }
  }, [data?.mine]);
  const submit = async (e) => {
    e.preventDefault();
    if (!rating) return toast({ title: t('errors.rating_required'), tone: 'error' });
    setBusy(true);
    try {
      await api(`/api/products/${product.slug}/reviews`, { method: 'POST', body: { rating, comment } });
      toast({ title: t('product.review_thanks') });
      setOpen(false);
      reload();
      invalidate(`/api/products/${product.slug}`);
    } catch (err) {
      toast({ title: t(`errors.${err.code}`), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  const total = (distribution || []).reduce((a, b) => a + b, 0);
  const dist =
    total > 0 ? (
      <div className="mt-5 space-y-1.5">
        {[5, 4, 3, 2, 1].map((n) => (
          <div key={n} className="flex items-center gap-2 text-xs">
            <span className="w-3 text-muted">{n}</span>
            <Star className="size-3 text-amber-400" fill="currentColor" strokeWidth={0} />
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <span className="block h-full rounded-full bg-amber-400" style={{ width: `${(distribution[n - 1] / total) * 100}%` }} />
            </span>
            <span className="w-6 text-end text-muted">{distribution[n - 1]}</span>
          </div>
        ))}
      </div>
    ) : null;
  return (
    <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div>
        <div className="card p-6">
          {product.rating.count > 0 ? (
            <>
              <p className="font-display text-5xl font-bold">{product.rating.avg.toFixed(1)}</p>
              <Stars value={product.rating.avg} size={18} className="mt-2" />
              <p className="mt-1 text-sm text-muted">{t('product.rating_count', { count: product.rating.count })}</p>
            </>
          ) : (
            <>
              <p className="font-semibold">{t('product.no_reviews')}</p>
              <p className="mt-1 text-sm text-muted">{t('product.no_reviews_text')}</p>
            </>
          )}
          {dist}
          <div className="mt-5">
            {auth.customer ? (
              <Button variant="outline" block icon={Star} onClick={() => setOpen((o) => !o)}>
                {t('product.write_review')}
              </Button>
            ) : (
              <Button variant="outline" block to={`/account?next=/product/${product.slug}`}>
                {t('product.review_login')}
              </Button>
            )}
          </div>
        </div>
      </div>
      <div>
        {open && (
          <form onSubmit={submit} className="card mb-6 space-y-4 p-5">
            <div>
              <p className="mb-2 text-sm font-semibold">{t('product.your_rating')}</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button type="button" key={n} onClick={() => setRating(n)} className="transition hover:scale-110" aria-label={`${n}`}>
                    <Star className={cx('size-8', n <= rating ? 'text-amber-400' : 'text-line-strong')} fill="currentColor" strokeWidth={0} />
                  </button>
                ))}
              </div>
            </div>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('product.review_placeholder')} maxLength={1000} />
            <Button type="submit" loading={busy}>
              {t('product.review_submit')}
            </Button>
          </form>
        )}
        {data?.items?.length ? (
          <div className="divide-y divide-line">
            {data.items.map((r) => (
              <div key={r.id} className="py-5 first:pt-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars value={r.rating} />
                  <span className="text-sm font-semibold">{r.author}</span>
                  {r.verified && (
                    <Badge tone="ok" icon={ShieldCheck}>
                      {t('product.verified')}
                    </Badge>
                  )}
                  <span className="text-xs text-muted">{date(r.created_at)}</span>
                </div>
                {r.comment && <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{r.comment}</p>}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StickyBar({ product, picker, targetRef }) {
  const { t, L } = useT();
  const cart = useCart();
  const toast = useToast();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [targetRef]);
  const v = picker.variant;
  const ok = v && v.stock > 0;
  return (
    <div className={cx('glass safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line transition-transform duration-300 lg:hidden', show ? 'translate-y-0' : 'translate-y-full')}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted">{L(product.name)}</p>
          <Price value={v?.price ?? product.price_min} compareAt={v?.compare_at} />
        </div>
        <Button
          icon={ShoppingBag}
          disabled={!ok}
          onClick={() => {
            cart.add(lineFrom(product, v), 1);
            toast({ title: t('product.added'), action: { label: t('cart.view_cart'), onClick: () => cart.setOpen(true) } });
          }}
        >
          {ok ? t('product.add_to_cart') : t('product.out_of_stock')}
        </Button>
      </div>
    </div>
  );
}

export default function Product() {
  const { slug } = useParams();
  const { t, L } = useT();
  const m = useMoney();
  const lists = useLists();
  const toast = useToast();
  const wa = useWhatsApp();
  const [copy] = useCopy();
  const { data, error, loading } = useApi(`/api/products/${slug}`, { keep: false });
  const p = data?.product?.slug === slug ? data.product : null;
  const picker = useVariantPicker(p);
  const imgRef = useRef(null);
  const buyRef = useRef(null);
  useTitle(p ? L(p.name) : null);

  useEffect(() => {
    if (p) lists.addRecent(p.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id]);
  const { data: recentData } = useApi(
    p && lists.recent.filter((id) => id !== p.id).length ? `/api/products?ids=${lists.recent.filter((id) => id !== p.id).slice(0, 10).join(',')}&limit=10` : null,
  );

  const highlights = useMemo(() => {
    if (!p) return [];
    const out = [];
    for (const [k, Icon] of HIGHLIGHT) {
      const s = p.specs.find((x) => x.key === k);
      if (s && out.length < 4) out.push({ ...s, Icon });
    }
    return out;
  }, [p]);

  if (error?.status === 404) return <NotFound text={t('product.not_found')} />;
  if (!p)
    return (
      <div className="wrap grid gap-10 pt-8 lg:grid-cols-2">
        <Skeleton className="aspect-square rounded-[30px]" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="mt-8 h-12 w-40" />
          <Skeleton className="h-28" />
          <Skeleton className="h-14" />
        </div>
      </div>
    );

  const v = picker.variant;
  const name = L(p.name);
  const specLabel = (k) => {
    const x = t(`specs.${k}`);
    return x === `specs.${k}` ? k : x;
  };
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: name, url });
      } catch {
        /* cancelled */
      }
    } else {
      await copy(url);
      toast({ title: t('product.link_copied'), tone: 'info' });
    }
  };
  const waText = t('product.whatsapp_msg', {
    name,
    variant: v && (v.color_en || v.opt) ? ` (${[v.color_en, v.opt].filter(Boolean).join(', ')})` : '',
    price: m.usd(v?.price ?? p.price_min),
    url: window.location.href.split('?')[0],
  });
  const waLink = wa(waText);
  const wished = lists.inWish(p.id);
  const comparing = lists.inCompare(p.id);

  return (
    <div className="animate-fade-in">
      <div className="wrap pt-5 sm:pt-7">
        <nav className="mb-5 flex items-center gap-1.5 overflow-hidden text-xs text-muted">
          <Link to="/" className="shrink-0 hover:text-ink">
            {t('nav.home')}
          </Link>
          <ChevronRight className="size-3 shrink-0 rtl:rotate-180" />
          {p.category && (
            <>
              <Link to={`/c/${p.category.slug}`} className="shrink-0 hover:text-ink">
                {L(p.category.name)}
              </Link>
              <ChevronRight className="size-3 shrink-0 rtl:rotate-180" />
            </>
          )}
          <span className="truncate text-ink">{name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
          <Gallery images={picker.images} name={name} imgRef={imgRef} badges={<ProductBadges p={p} className="absolute start-4 top-4" />} />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {p.brand && (
                <Link to={`/b/${p.brand.slug}`} className="eyebrow text-muted hover:text-ink">
                  {p.brand.name}
                </Link>
              )}
              {p.condition !== 'new' && <Badge tone="inverse">{t(`conditions.${p.condition}`)}</Badge>}
            </div>
            <h1 className="mt-2 font-display text-3xl font-bold leading-[1.08] tracking-tight text-balance sm:text-[42px]">{name}</h1>
            {L(p.subtitle) && <p className="mt-2 text-[15px] text-muted sm:text-base">{L(p.subtitle)}</p>}
            {p.rating.count > 0 && (
              <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-sm">
                <Stars value={p.rating.avg} /> <span className="font-semibold">{p.rating.avg.toFixed(1)}</span> <span className="text-muted">({t('product.rating_count', { count: p.rating.count })})</span>
              </a>
            )}

            {p.deal_ends_at && (
              <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-hot/10 px-4 py-3">
                <span className="text-sm font-bold text-hot">{t('product.deal_ends')}</span>
                <Countdown to={p.deal_ends_at} />
              </div>
            )}

            <div className="mt-6" ref={buyRef}>
              <PurchasePanel product={p} picker={picker} imageRef={imgRef} />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={Heart}
                className={wished ? 'text-hot' : ''}
                onClick={() => {
                  const on = lists.toggleWish(p.id);
                  toast({ title: on ? t('product.wishlist_added') : t('product.wishlist_removed'), tone: 'info', icon: Heart });
                }}
              >
                {t('product.wishlist_add')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={ArrowLeftRight}
                className={comparing ? 'ring-2 ring-ink' : ''}
                onClick={() => {
                  const on = lists.toggleCompare(p.id);
                  if (on) toast({ title: t('product.compare_added'), tone: 'info', action: { label: t('nav.compare'), to: '/compare' } });
                }}
              >
                {t('product.compare_add')}
              </Button>
              <Button variant="secondary" size="sm" icon={Share2} onClick={share}>
                {t('product.share')}
              </Button>
              {waLink && (
                <Button variant="secondary" size="sm" icon={MessageCircle} href={waLink} target="_blank" rel="noreferrer" className="text-wa">
                  {t('product.ask_whatsapp')}
                </Button>
              )}
            </div>

            <div className="mt-7">
              <DeliveryBox price={v?.price ?? p.price_min} />
            </div>

            {(L(p.warranty) || p.fits.length > 0) && (
              <div className="mt-5 space-y-3 text-sm">
                {L(p.warranty) && (
                  <p className="flex items-center gap-2.5">
                    <ShieldCheck className="size-5 text-muted" strokeWidth={1.8} /> <span className="font-semibold">{t('product.warranty')}:</span> {L(p.warranty)}
                  </p>
                )}
                {p.fits.length > 0 && (
                  <div>
                    <p className="mb-2 font-semibold">{t('product.works_with')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.fits.slice(0, 14).map((f) =>
                        f === 'Universal' ? (
                          <span key={f} className="rounded-full bg-surface-3 px-3 py-1 text-xs font-semibold">
                            {document.documentElement.lang === 'ar' ? 'كل الهواتف' : 'All phones'}
                          </span>
                        ) : (
                          <Link key={f} to={`/finder/${encodeURIComponent(f)}`} className="rounded-full border border-line-strong px-3 py-1 text-xs font-semibold hover:border-ink">
                            {f}
                          </Link>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {highlights.length > 0 && (
        <section className="wrap mt-16">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {highlights.map((h) => (
              <div key={h.key} className="card p-5">
                <h.Icon className="size-6 text-muted" strokeWidth={1.6} />
                <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted">{specLabel(h.key)}</p>
                <p className="mt-1 text-sm font-semibold leading-snug">{h.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="wrap mt-12 grid gap-10 lg:grid-cols-2">
        {(L(p.description) || p.description.en) && (
          <div>
            <h2 className="font-display text-2xl font-bold">{t('product.description')}</h2>
            <p className="mt-4 whitespace-pre-line text-[15.5px] leading-relaxed text-ink-2">{L(p.description) || p.description.en}</p>
          </div>
        )}
        {p.specs.length > 0 && (
          <div>
            <h2 className="font-display text-2xl font-bold">{t('product.specs')}</h2>
            <dl className="mt-4 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
              {p.specs.map((s) => (
                <div key={s.key} className="grid grid-cols-[40%_minmax(0,1fr)] gap-4 px-5 py-3.5 text-sm">
                  <dt className="font-semibold text-muted">{specLabel(s.key)}</dt>
                  <dd className="font-medium" dir="auto">
                    {s.value}
                  </dd>
                </div>
              ))}
              {p.opts.length > 0 && (
                <div className="grid grid-cols-[40%_minmax(0,1fr)] gap-4 px-5 py-3.5 text-sm">
                  <dt className="font-semibold text-muted">{L(p.opt_label) || t('specs.storage')}</dt>
                  <dd className="font-medium" dir="ltr">
                    {p.opts.join(' · ')}
                  </dd>
                </div>
              )}
              {v?.sku && (
                <div className="grid grid-cols-[40%_minmax(0,1fr)] gap-4 px-5 py-3.5 text-sm">
                  <dt className="font-semibold text-muted">{t('product.sku')}</dt>
                  <dd className="font-mono text-xs" dir="ltr">
                    {v.sku}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </section>

      {data.accessories?.length > 0 && (
        <section className="wrap mt-16">
          <SectionTitle eyebrow={t('product.accessories_eyebrow')} title={t('product.accessories')} />
          <ProductRail items={data.accessories} />
        </section>
      )}
      {data.fits_products?.length > 0 && (
        <section className="wrap mt-16">
          <SectionTitle title={t('product.fits_phones')} />
          <ProductRail items={data.fits_products} />
        </section>
      )}
      {data.together?.length > 0 && (
        <section className="wrap mt-16">
          <SectionTitle title={t('product.together')} />
          <ProductRail items={data.together} />
        </section>
      )}

      <section id="reviews" className="wrap mt-16 scroll-mt-28">
        <SectionTitle title={t('product.reviews')} />
        <Reviews product={p} distribution={data.rating_distribution} />
      </section>

      {data.related?.length > 0 && (
        <section className="wrap mt-16">
          <SectionTitle title={t('product.related')} />
          <ProductRail items={data.related} />
        </section>
      )}
      {recentData?.items?.length > 0 && (
        <section className="wrap mt-16">
          <SectionTitle title={t('product.recent')} />
          <ProductRail items={recentData.items} />
        </section>
      )}
      <StickyBar product={p} picker={picker} targetRef={buyRef} />
    </div>
  );
}

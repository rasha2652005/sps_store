import { useRef } from 'react';
import { Link } from 'react-router';
import { Heart, Plus, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge, Img, Price, Skeleton, Stars, cx } from '../ui.jsx';
import { useT } from '../../lib/prefs.jsx';
import { flyToCart, lineFrom, useCart } from '../../lib/cart.jsx';
import { useLists } from '../../lib/account.jsx';
import { useToast } from '../../lib/toast.jsx';
import { useUI } from '../../lib/ui.jsx';
import { prefetch } from '../../lib/api.js';

export function ProductBadges({ p, className }) {
  const { t } = useT();
  return (
    <div className={cx('pointer-events-none flex flex-col items-start gap-1.5', className)}>
      {p.discount_pct > 0 && (
        <Badge tone="hot" slant>
          {t('product.off', { pct: p.discount_pct })}
        </Badge>
      )}
      {p.condition !== 'new' && <Badge tone="inverse">{t(`conditions.${p.condition}`)}</Badge>}
      {p.is_new && p.condition === 'new' && !p.discount_pct && <Badge tone="outline" className="bg-surface/80 backdrop-blur">{t('common.new')}</Badge>}
    </div>
  );
}

export function ProductCard({ p, className, eager, dark }) {
  const { t, L } = useT();
  const cart = useCart();
  const lists = useLists();
  const toast = useToast();
  const ui = useUI();
  const imgRef = useRef(null);
  if (!p) return null;
  const img1 = p.images[0]?.url;
  // second image: the back view of the same color, or another color
  const img2 = p.images.find((i, idx) => idx > 0 && (!p.images[0].color || i.color === p.images[0].color))?.url || p.images[1]?.url;
  const single = p.variants.length === 1;
  const wished = lists ? lists.inWish(p.id) : false;
  const href = `/product/${p.slug}`;

  const quickAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!p.in_stock || !cart) return;
    if (!single) return ui?.openQuickView(p.slug);
    const v = p.variants[0];
    cart.add(lineFrom(p, v), 1);
    flyToCart(imgRef.current?.querySelector('img'));
    toast({ title: t('product.added'), text: L(p.name), image: img1, action: { label: t('cart.checkout'), to: '/checkout' } });
  };
  const toggleWish = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!lists) return;
    const on = lists.toggleWish(p.id);
    toast({ title: on ? t('product.wishlist_added') : t('product.wishlist_removed'), tone: 'info', icon: Heart, duration: 2200 });
  };

  return (
    <article className={cx('group relative flex min-w-0 flex-col', className)} onMouseEnter={() => prefetch(`/api/products/${p.slug}`)}>
      <Link to={href} className={cx('relative block aspect-square overflow-hidden rounded-[22px] transition duration-500', dark ? 'bg-white/[0.06]' : 'silver')} ref={imgRef}>
        <Img
          thumb
          src={img1}
          alt={L(p.name)}
          eager={eager}
          className={cx('absolute inset-0 p-[9%] transition duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.06]', img2 && 'lg:group-hover:opacity-0', !p.in_stock && 'opacity-60 grayscale-[35%]')}
        />
        {img2 && <Img thumb src={img2} alt="" className="absolute inset-0 hidden p-[9%] opacity-0 transition duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.06] group-hover:opacity-100 lg:block" />}
        <ProductBadges p={p} className="absolute start-3 top-3" />
        <button
          onClick={toggleWish}
          className={cx(
            'absolute end-2.5 top-2.5 grid size-9 place-items-center rounded-full bg-surface/85 backdrop-blur transition hover:scale-110',
            wished ? 'text-hot' : 'text-ink lg:opacity-0 lg:group-hover:opacity-100',
          )}
          aria-label={t('product.wishlist_add')}
        >
          <Heart className="size-[18px]" fill={wished ? 'currentColor' : 'none'} strokeWidth={1.8} />
        </button>
        {p.in_stock ? (
          <button
            onClick={quickAdd}
            className="absolute bottom-3 end-3 grid size-10 place-items-center rounded-full bg-inverse text-on-inverse shadow-[var(--shadow-pop)] transition duration-300 hover:scale-110 lg:translate-y-2 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100"
            aria-label={single ? t('product.add_to_cart') : t('product.quick_view')}
            title={single ? t('product.add_to_cart') : t('product.quick_view')}
          >
            {single ? <Plus className="size-5" strokeWidth={2.2} /> : <Eye className="size-[18px]" />}
          </button>
        ) : (
          <span className="absolute inset-x-3 bottom-3 rounded-full bg-surface/90 py-1.5 text-center text-xs font-bold text-muted backdrop-blur">{t('product.out_of_stock')}</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col px-1 pt-3">
        <p className={cx('truncate text-[11.5px] font-semibold uppercase tracking-wide', dark ? 'text-white/50' : 'text-muted')}>
          {[p.brand?.name, p.category && L(p.category.name)].filter(Boolean).join(' · ')}
        </p>
        <Link to={href} className={cx('mt-1 line-clamp-2 text-[15px] font-semibold leading-snug hover:underline', dark && 'text-white')}>
          {L(p.name)}
        </Link>
        {p.colors.length > 1 && (
          <div className="mt-2 flex items-center gap-1">
            {p.colors.slice(0, 5).map((c) => (
              <span key={c.en} title={L(c)} className="size-3.5 rounded-full border border-black/10 shadow-inner dark:border-white/20" style={{ background: c.hex }} />
            ))}
            {p.colors.length > 5 && <span className="text-[11px] text-muted">+{p.colors.length - 5}</span>}
          </div>
        )}
        <div className={cx('mt-auto pt-2', dark && 'text-white')}>
          <Price value={p.price_min} compareAt={p.compare_at} from={p.price_max > p.price_min} />
        </div>
        {p.rating.count > 0 && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <Stars value={p.rating.avg} size={12} /> ({p.rating.count})
          </div>
        )}
      </div>
    </article>
  );
}

export function CardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-square rounded-[22px]" />
      <Skeleton className="mt-3 h-3 w-1/3" />
      <Skeleton className="mt-2 h-4 w-4/5" />
      <Skeleton className="mt-3 h-4 w-1/4" />
    </div>
  );
}

export function ProductGrid({ items, loading, count = 8, className }) {
  return (
    <div className={cx('grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4', className)}>
      {loading && !items?.length ? Array.from({ length: count }, (_, i) => <CardSkeleton key={i} />) : items?.map((p, i) => <ProductCard key={p.id} p={p} eager={i < 4} />)}
    </div>
  );
}

/** Horizontal scrolling row of products with arrow buttons. */
export function ProductRail({ items, loading, dark, className }) {
  const ref = useRef(null);
  const { rtl } = useT();
  const scroll = (dir) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85 * (rtl ? -1 : 1), behavior: 'smooth' });
  };
  return (
    <div className={cx('group/rail relative', className)}>
      <div ref={ref} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-2 sm:-mx-6 sm:gap-5 sm:px-6 lg:-mx-2 lg:px-2">
        {loading && !items?.length
          ? Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="w-[46%] shrink-0 sm:w-[31%] lg:w-[23%] xl:w-[19%]">
                <CardSkeleton />
              </div>
            ))
          : items?.map((p) => (
              <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[23%] xl:w-[19%]">
                <ProductCard p={p} dark={dark} />
              </div>
            ))}
      </div>
      {items?.length > 4 && (
        <>
          <button onClick={() => scroll(-1)} className="absolute -start-4 top-[38%] z-10 hidden size-11 place-items-center rounded-full bg-surface text-ink shadow-[var(--shadow-lift)] transition hover:scale-105 lg:grid lg:opacity-0 lg:group-hover/rail:opacity-100" aria-label="Previous">
            <ChevronLeft className="size-5 rtl:-scale-x-100" />
          </button>
          <button onClick={() => scroll(1)} className="absolute -end-4 top-[38%] z-10 hidden size-11 place-items-center rounded-full bg-surface text-ink shadow-[var(--shadow-lift)] transition hover:scale-105 lg:grid lg:opacity-0 lg:group-hover/rail:opacity-100" aria-label="Next">
            <ChevronRight className="size-5 rtl:-scale-x-100" />
          </button>
        </>
      )}
    </div>
  );
}

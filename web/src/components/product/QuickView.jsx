import { useRef } from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { Img, Modal, Skeleton } from '../ui.jsx';
import { useApi } from '../../lib/api.js';
import { useT } from '../../lib/prefs.jsx';
import { useUI } from '../../lib/ui.jsx';
import { useVariantPicker } from './variants.js';
import { PurchasePanel } from './Purchase.jsx';
import { ProductBadges } from './ProductCard.jsx';

export function QuickView() {
  const ui = useUI();
  const { t, L } = useT();
  const slug = ui.quickView;
  const { data } = useApi(slug ? `/api/products/${slug}` : null, { keep: false });
  const p = data?.product?.slug === slug ? data.product : null;
  const picker = useVariantPicker(p);
  const imgRef = useRef(null);
  return (
    <Modal open={!!slug} onClose={ui.closeQuickView} size="lg" title={t('product.quick_view')}>
      {!p ? (
        <div className="grid gap-6 sm:grid-cols-2">
          <Skeleton className="aspect-square" />
          <div className="space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-24" />
          </div>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          <div ref={imgRef} className="relative aspect-square overflow-hidden rounded-3xl silver">
            <Img key={picker.images[0]?.url} src={picker.images[0]?.url} alt={L(p.name)} className="absolute inset-0 p-8" eager />
            <ProductBadges p={p} className="absolute start-3 top-3" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{p.brand?.name}</p>
            <h3 className="mt-1 font-display text-2xl font-bold leading-tight">{L(p.name)}</h3>
            {L(p.subtitle) && <p className="mt-1 text-sm text-muted">{L(p.subtitle)}</p>}
            <div className="mt-5">
              <PurchasePanel product={p} picker={picker} compact imageRef={imgRef} />
            </div>
            <Link to={`/product/${p.slug}`} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline">
              {t('product.view_details')} <ArrowRight className="size-4 rtl:-scale-x-100" />
            </Link>
          </div>
        </div>
      )}
    </Modal>
  );
}

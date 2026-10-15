import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Copy, ExternalLink, Minus, Package, Pencil, Plus, Search, Star, Trash2, Bell } from 'lucide-react';
import { api, invalidate, qs, useApi } from '../lib/api.js';
import { useT } from '../lib/prefs.jsx';
import { useMoney } from '../lib/store.jsx';
import { useToast } from '../lib/toast.jsx';
import { Badge, Button, Empty, IconButton, Img, Input, Select, Skeleton, Switch, cx } from '../components/ui.jsx';
import { Confirm, PageHeader, Pager, storeHref } from './kit.jsx';

function StockEditor({ product, onChanged }) {
  const { t } = useT();
  const toast = useToast();
  const [rows, setRows] = useState(product.variants);
  useEffect(() => setRows(product.variants), [product.variants]);
  const save = async (v, patch) => {
    try {
      const r = await api(`/api/admin/variants/${v.id}`, { method: 'PATCH', body: patch });
      setRows((list) => list.map((x) => (x.id === v.id ? { ...x, ...r.variant } : x)));
      onChanged?.();
    } catch (e) {
      toast({ title: e.message, tone: 'error' });
    }
  };
  return (
    <div className="grid gap-2 bg-surface-2 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((v) => (
        <div key={v.id} className="flex items-center gap-2 rounded-xl bg-surface p-2.5 ring-1 ring-line">
          {v.color_hex && <span className="size-4 shrink-0 rounded-full border border-black/10" style={{ background: v.color_hex }} />}
          <span className="min-w-0 flex-1 truncate text-xs font-semibold">{[v.color_en, v.opt].filter(Boolean).join(' · ') || t('admin.default_option')}</span>
          <span className="flex items-center rounded-full border border-line-strong" dir="ltr">
            <button className="grid size-7 place-items-center rounded-full hover:bg-surface-3" onClick={() => save(v, { stock: Math.max(0, v.stock - 1) })} aria-label="-1">
              <Minus className="size-3.5" />
            </button>
            <input
              className="w-10 bg-transparent text-center text-sm font-bold outline-none"
              defaultValue={v.stock}
              key={v.stock}
              inputMode="numeric"
              onBlur={(e) => Number(e.target.value) !== v.stock && save(v, { stock: Number(e.target.value) || 0 })}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
            <button className="grid size-7 place-items-center rounded-full hover:bg-surface-3" onClick={() => save(v, { stock: v.stock + 1 })} aria-label="+1">
              <Plus className="size-3.5" />
            </button>
          </span>
          <label className="flex items-center rounded-lg border border-line-strong px-2 text-xs" dir="ltr">
            $
            <input
              className="w-14 bg-transparent py-1.5 text-sm font-semibold outline-none"
              defaultValue={v.price}
              key={v.price}
              inputMode="decimal"
              onBlur={(e) => Number(e.target.value) !== v.price && e.target.value !== '' && save(v, { price: Number(e.target.value) })}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          </label>
        </div>
      ))}
    </div>
  );
}

export default function Products() {
  const { t, L, lang } = useT();
  const m = useMoney();
  const toast = useToast();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') || '');
  const [open, setOpen] = useState(null);
  const [del, setDel] = useState(null);
  const tax = useApi('/api/admin/taxonomy');
  const update = (patch) => {
    const n = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) (v === null || v === '' ? n.delete(k) : n.set(k, v));
    setSp(n, { replace: true });
  };
  useEffect(() => {
    const id = setTimeout(() => (sp.get('q') || '') !== q && update({ q, page: null }), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const params = { q: sp.get('q'), category: sp.get('category'), brand: sp.get('brand'), status: sp.get('status'), stock: sp.get('stock'), sort: sp.get('sort'), page: sp.get('page') };
  const key = `/api/admin/products${qs(params)}`;
  const { data, reload } = useApi(key, { ttl: 10000 });
  const refreshAll = () => {
    invalidate('/api/admin/products', '/api/products', '/api/home', '/api/bootstrap', '/api/admin/dashboard');
    reload();
  };
  const toggle = async (p, field) => {
    await api(`/api/admin/products/${p.id}`, { method: 'PATCH', body: { [field]: !p[field] } });
    refreshAll();
  };
  const duplicate = async (p) => {
    const r = await api(`/api/admin/products/${p.id}/duplicate`, { method: 'POST', body: {} });
    toast({ title: t('admin.duplicated') });
    refreshAll();
    navigate(`/admin/products/${r.product.id}`);
  };
  const remove = async () => {
    await api(`/api/admin/products/${del.id}`, { method: 'DELETE' });
    setDel(null);
    toast({ title: t('admin.deleted'), tone: 'info' });
    refreshAll();
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('admin.nav.products')}
        subtitle={data ? t('admin.products_count', { count: data.total }) : ''}
        actions={
          <Button icon={Plus} to="/admin/products/new">
            {t('admin.add_product')}
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="min-w-[220px] flex-1">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admin.search_products')} prefix={<Search className="size-4" />} />
        </div>
        <Select value={sp.get('category') || ''} onChange={(e) => update({ category: e.target.value, page: null })} className="w-auto">
          <option value="">{t('admin.all_categories')}</option>
          {tax.data?.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {lang === 'ar' ? c.name_ar || c.name_en : c.name_en}
            </option>
          ))}
        </Select>
        <Select value={sp.get('brand') || ''} onChange={(e) => update({ brand: e.target.value, page: null })} className="w-auto">
          <option value="">{t('admin.all_brands')}</option>
          {tax.data?.brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        <Select value={sp.get('stock') || ''} onChange={(e) => update({ stock: e.target.value, page: null })} className="w-auto">
          <option value="">{t('admin.all_stock')}</option>
          <option value="low">{t('admin.low_stock')}</option>
          <option value="out">{t('product.out_of_stock')}</option>
        </Select>
        <Select value={sp.get('status') || ''} onChange={(e) => update({ status: e.target.value, page: null })} className="w-auto">
          <option value="">{t('admin.all_status')}</option>
          <option value="active">{t('admin.visible')}</option>
          <option value="hidden">{t('admin.hidden')}</option>
        </Select>
      </div>

      <div className="card overflow-hidden">
        {!data ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : !data.items.length ? (
          <Empty icon={Package} title={t('admin.no_products')}>
            <Button icon={Plus} to="/admin/products/new">
              {t('admin.add_product')}
            </Button>
          </Empty>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1fr)_140px_120px_110px_80px_150px] gap-4 border-b border-line bg-surface-2 px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted lg:grid">
              <span>{t('admin.product')}</span>
              <span>{t('admin.price')}</span>
              <span>{t('admin.stock')}</span>
              <span>{t('admin.visible')}</span>
              <span>{t('admin.featured')}</span>
              <span />
            </div>
            <div className="divide-y divide-line">
              {data.items.map((p) => {
                const stockTone = p.stock === 0 ? 'danger' : p.variants.some((v) => v.stock <= 3) ? 'warn' : 'ok';
                return (
                  <Fragment key={p.id}>
                    <div className={cx('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_140px_120px_110px_80px_150px]', !p.active && 'opacity-60')}>
                      <Link to={`/admin/products/${p.id}`} className="flex min-w-0 items-center gap-3">
                        <Img thumb src={p.image} alt="" className="size-14 shrink-0 rounded-2xl silver p-1" />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold hover:underline">{lang === 'ar' ? p.name_ar || p.name_en : p.name_en}</span>
                          <span className="block truncate text-xs text-muted">
                            {[p.brand, lang === 'ar' ? p.category_ar || p.category_en : p.category_en].filter(Boolean).join(' · ')}
                            {p.condition !== 'new' && ` · ${t(`conditions.${p.condition}`)}`}
                          </span>
                        </span>
                      </Link>
                      <span className="hidden text-sm font-semibold lg:block" dir="ltr">
                        {p.price_min === p.price_max ? m.usd(p.price_min) : `${m.usd(p.price_min)} – ${m.usd(p.price_max)}`}
                      </span>
                      <button onClick={() => setOpen(open === p.id ? null : p.id)} className="hidden items-center gap-2 text-start lg:flex">
                        <Badge tone={stockTone}>{p.stock}</Badge>
                        <span className="text-xs text-muted underline decoration-dotted underline-offset-4">{t('admin.variants_count', { count: p.variant_count })}</span>
                        {p.alerts > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-xs font-bold text-info" title={t('admin.waiting_alerts')}>
                            <Bell className="size-3" /> {p.alerts}
                          </span>
                        )}
                      </button>
                      <span className="hidden lg:block">
                        <Switch checked={p.active} onChange={() => toggle(p, 'active')} />
                      </span>
                      <button onClick={() => toggle(p, 'featured')} className="hidden lg:block" aria-label={t('admin.featured')}>
                        <Star className={cx('size-5', p.featured ? 'fill-amber-400 text-amber-400' : 'text-line-strong')} />
                      </button>
                      <div className="flex items-center justify-end gap-0.5">
                        <IconButton icon={Pencil} label={t('common.edit')} size="sm" to={`/admin/products/${p.id}`} />
                        <IconButton icon={Copy} label={t('admin.duplicate')} size="sm" onClick={() => duplicate(p)} className="hidden sm:inline-flex" />
                        <IconButton icon={ExternalLink} label={t('admin.view_store')} size="sm" href={storeHref(`/product/${p.slug}`)} target="_blank" rel="noreferrer" className="hidden sm:inline-flex" />
                        <IconButton icon={Trash2} label={t('common.delete')} size="sm" className="text-danger" onClick={() => setDel(p)} />
                      </div>
                      <div className="col-span-2 flex items-center gap-3 lg:hidden">
                        <span className="text-sm font-semibold" dir="ltr">
                          {m.usd(p.price_min)}
                        </span>
                        <button onClick={() => setOpen(open === p.id ? null : p.id)}>
                          <Badge tone={stockTone}>
                            {t('admin.stock')}: {p.stock}
                          </Badge>
                        </button>
                        <span className="flex-1" />
                        <Switch checked={p.active} onChange={() => toggle(p, 'active')} />
                      </div>
                    </div>
                    {open === p.id && <StockEditor product={p} onChanged={() => invalidate('/api/products', '/api/home', '/api/admin/dashboard')} />}
                  </Fragment>
                );
              })}
            </div>
            <Pager page={data.page} pages={data.pages} onPage={(pg) => update({ page: String(pg) })} />
          </>
        )}
      </div>
      <Confirm open={!!del} title={t('admin.delete_product_q')} text={del ? (lang === 'ar' ? del.name_ar || del.name_en : del.name_en) : ''} onClose={() => setDel(null)} onConfirm={remove} />
    </div>
  );
}

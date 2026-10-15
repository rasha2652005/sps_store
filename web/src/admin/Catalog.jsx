import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api, invalidate, setCache, useApi } from '../lib/api.js';
import { useT } from '../lib/prefs.jsx';
import { useToast } from '../lib/toast.jsx';
import { Button, Field, IconButton, Input, Modal, Select, Skeleton, cx } from '../components/ui.jsx';
import { CATEGORY_ICONS, categoryIcon } from '../components/icons.jsx';
import { Confirm, PageHeader, Panel } from './kit.jsx';

const KINDS = ['phone', 'tablet', 'audio', 'wearable', 'accessory'];

function CategoryForm({ initial, onDone }) {
  const { t } = useT();
  const toast = useToast();
  const [f, setF] = useState({ name_en: '', name_ar: '', icon: 'package', kind: 'accessory', sort: 0, slug: '', ...initial });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = initial?.id ? await api(`/api/admin/categories/${initial.id}`, { method: 'PUT', body: f }) : await api('/api/admin/categories', { method: 'POST', body: f });
      setCache('/api/admin/taxonomy', r);
      invalidate('/api/bootstrap', '/api/products', '/api/home');
      toast({ title: t('admin.saved') });
      onDone();
    } catch (err) {
      toast({ title: err.message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('admin.name_en')} required>
          <Input value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} required />
        </Field>
        <Field label={t('admin.name_ar')}>
          <Input value={f.name_ar} onChange={(e) => setF({ ...f, name_ar: e.target.value })} dir="rtl" />
        </Field>
        <Field label={t('admin.kind')} hint={t('admin.kind_hint')}>
          <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`admin.kinds.${k}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('admin.sort')} hint={t('admin.sort_hint')}>
          <Input type="number" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })} />
        </Field>
      </div>
      <Field label={t('admin.icon')}>
        <div className="flex flex-wrap gap-2">
          {Object.entries(CATEGORY_ICONS).map(([name, Icon]) => (
            <button key={name} type="button" onClick={() => setF({ ...f, icon: name })} className={cx('grid size-11 place-items-center rounded-xl border transition', f.icon === name ? 'border-ink bg-ink text-bg' : 'border-line-strong hover:border-ink')} title={name}>
              <Icon className="size-5" strokeWidth={1.8} />
            </button>
          ))}
        </div>
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={busy}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}

export default function Catalog() {
  const { t, lang } = useT();
  const toast = useToast();
  const { data } = useApi('/api/admin/taxonomy');
  const [cat, setCat] = useState(null);
  const [brand, setBrand] = useState(null);
  const [brandName, setBrandName] = useState('');
  const [del, setDel] = useState(null);

  if (!data) return <Skeleton className="h-96" />;

  const saveBrand = async (e) => {
    e.preventDefault();
    try {
      const r = brand?.id ? await api(`/api/admin/brands/${brand.id}`, { method: 'PUT', body: { name: brandName, sort: brand.sort } }) : await api('/api/admin/brands', { method: 'POST', body: { name: brandName } });
      setCache('/api/admin/taxonomy', r);
      invalidate('/api/bootstrap', '/api/products');
      setBrand(null);
      setBrandName('');
      toast({ title: t('admin.saved') });
    } catch (err) {
      toast({ title: err.message, tone: 'error' });
    }
  };
  const remove = async () => {
    try {
      const r = await api(`/api/admin/${del.type}/${del.item.id}`, { method: 'DELETE' });
      setCache('/api/admin/taxonomy', r);
      invalidate('/api/bootstrap');
      toast({ title: t('admin.deleted'), tone: 'info' });
    } catch (err) {
      toast({ title: t(`admin.errors.${err.code}`) !== `admin.errors.${err.code}` ? t(`admin.errors.${err.code}`) : err.message, tone: 'error' });
    }
    setDel(null);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title={t('admin.nav.catalog')} subtitle={t('admin.catalog_text')} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel
          title={t('admin.categories')}
          pad={false}
          action={
            <Button size="sm" icon={Plus} onClick={() => setCat({})}>
              {t('common.add')}
            </Button>
          }
        >
          <div className="divide-y divide-line">
            {data.categories.map((c) => {
              const Icon = categoryIcon(c.icon);
              return (
                <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl silver">
                    <Icon className="size-5" strokeWidth={1.7} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{lang === 'ar' ? c.name_ar || c.name_en : c.name_en}</p>
                    <p className="text-xs text-muted">
                      {lang === 'ar' ? c.name_en : c.name_ar} · {t(`admin.kinds.${c.kind}`)} · {t('admin.products_count', { count: c.products })}
                    </p>
                  </div>
                  <span className="text-xs text-faint">#{c.sort}</span>
                  <IconButton icon={Pencil} size="sm" label={t('common.edit')} onClick={() => setCat(c)} />
                  <IconButton icon={Trash2} size="sm" label={t('common.delete')} className="text-danger" onClick={() => setDel({ type: 'categories', item: c })} />
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel title={t('admin.brands')} pad={false}>
          <form onSubmit={saveBrand} className="flex gap-2 border-b border-line p-4">
            <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder={brand ? brand.name : t('admin.new_brand')} className="flex-1" required />
            <Button type="submit" icon={brand ? Pencil : Plus}>
              {brand ? t('common.save') : t('common.add')}
            </Button>
            {brand && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setBrand(null);
                  setBrandName('');
                }}
              >
                {t('common.cancel')}
              </Button>
            )}
          </form>
          <div className="divide-y divide-line">
            {data.brands.map((b) => (
              <div key={b.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex-1 font-display text-lg font-bold">{b.name}</span>
                <span className="text-xs text-muted">{t('admin.products_count', { count: b.products })}</span>
                <IconButton
                  icon={Pencil}
                  size="sm"
                  label={t('common.edit')}
                  onClick={() => {
                    setBrand(b);
                    setBrandName(b.name);
                  }}
                />
                <IconButton icon={Trash2} size="sm" label={t('common.delete')} className="text-danger" onClick={() => setDel({ type: 'brands', item: b })} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Modal open={!!cat} onClose={() => setCat(null)} title={cat?.id ? t('admin.edit_category') : t('admin.new_category')}>
        {cat && <CategoryForm initial={cat} onDone={() => setCat(null)} />}
      </Modal>
      <Confirm open={!!del} title={t('admin.delete_q', { name: del ? del.item.name_en || del.item.name : '' })} onClose={() => setDel(null)} onConfirm={remove} />
    </div>
  );
}

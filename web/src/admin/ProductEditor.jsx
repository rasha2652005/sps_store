import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, ArrowLeftRight, ExternalLink, GripVertical, ImagePlus, Link2, Plus, Sparkles, Trash2, Upload, Wand2, X, Loader2 } from 'lucide-react';
import { api, invalidate, setCache, useApi } from '../lib/api.js';
import { useT } from '../lib/prefs.jsx';
import { useStore } from '../lib/store.jsx';
import { useToast } from '../lib/toast.jsx';
import { Badge, Button, Field, IconButton, Img, Input, Segmented, Select, Skeleton, Switch, Textarea, cx } from '../components/ui.jsx';
import { ProductCard } from '../components/product/ProductCard.jsx';
import { colorFamilyClient } from './colors.js';
import { Confirm, Panel, resizeImage, storeHref } from './kit.jsx';

const EMPTY = {
  name_en: '',
  name_ar: '',
  subtitle_en: '',
  subtitle_ar: '',
  description_en: '',
  description_ar: '',
  category_id: '',
  brand_id: '',
  condition: 'new',
  warranty_en: '',
  warranty_ar: '',
  opt_label_en: '',
  opt_label_ar: '',
  device: '',
  images: [],
  specs: [],
  tags: '',
  fits: [],
  featured: false,
  active: true,
  deal_ends_at: '',
  slug: '',
  variants: [{ color_en: '', color_ar: '', color_hex: '', opt: '', price: '', compare_at: '', stock: 1, sku: '' }],
};

const SPEC_KEYS = ['display', 'chip', 'ram', 'storage', 'camera', 'front_camera', 'battery', 'charging', 'os', 'sim', 'network', 'water', 'weight', 'pen', 'battery_health', 'condition', 'in_box', 'power', 'ports', 'plug', 'cable', 'capacity', 'connectors', 'length', 'material', 'protection', 'magsafe', 'hardness', 'thickness', 'privacy', 'mount', 'anc', 'battery_life', 'bluetooth', 'connectivity', 'compatibility', 'size'];
const PHONE_TEMPLATE = ['display', 'chip', 'ram', 'camera', 'front_camera', 'battery', 'charging', 'water', 'os'];
const COMMON_COLORS = [
  ['Black', 'أسود', '#1f1f22'],
  ['White', 'أبيض', '#f3f3f1'],
  ['Silver', 'فضي', '#dcdde0'],
  ['Gray', 'رمادي', '#8e8f94'],
  ['Blue', 'أزرق', '#3e6fa8'],
  ['Green', 'أخضر', '#9cb59a'],
  ['Purple', 'بنفسجي', '#b8a4d6'],
  ['Pink', 'زهري', '#efc6d1'],
  ['Gold', 'ذهبي', '#e5d3a8'],
  ['Orange', 'برتقالي', '#f4762e'],
  ['Red', 'أحمر', '#d6453d'],
];

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------------------------------------------------------------- images
function Images({ images, onChange, colors }) {
  const { t } = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(0);
  const [drag, setDrag] = useState(false);
  const [from, setFrom] = useState(null);
  const [url, setUrl] = useState('');
  const input = useRef(null);
  const latest = useRef(images);
  latest.current = images;

  const upload = async (files) => {
    const list = [...files].filter((f) => f.type.startsWith('image/')).slice(0, 12);
    if (!list.length) return;
    setBusy((b) => b + list.length);
    for (const f of list) {
      try {
        const data = await resizeImage(f, 1600);
        const thumb = await resizeImage(f, 640).catch(() => null); // lighter photo for product lists
        const r = await api('/api/admin/uploads', { method: 'POST', body: { data_url: data, thumb_data_url: thumb || undefined } });
        onChange([...latest.current, { url: r.url, color: '' }]);
      } catch (e) {
        toast({ title: e.code ? t(`admin.errors.${e.code}`) : t('admin.errors.image_invalid'), tone: 'error' });
      } finally {
        setBusy((b) => b - 1);
      }
    }
  };
  const move = (i, j) => {
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    const [x] = next.splice(i, 1);
    next.splice(j, 0, x);
    onChange(next);
  };
  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (from === null) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files?.length) upload(e.dataTransfer.files);
        }}
        className={cx('grid grid-cols-3 gap-3 rounded-2xl sm:grid-cols-4 xl:grid-cols-5', drag && 'ring-2 ring-ink ring-offset-4 ring-offset-surface')}
      >
        {images.map((im, i) => (
          <div
            key={im.url + i}
            draggable
            onDragStart={() => setFrom(i)}
            onDragEnd={() => setFrom(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (from !== null) move(from, i);
              setFrom(null);
            }}
            className={cx('group relative overflow-hidden rounded-2xl border border-line bg-surface-2', from === i && 'opacity-40')}
          >
            <Img thumb src={im.url} alt="" className="aspect-square p-2" />
            {i === 0 && <Badge tone="inverse" className="absolute start-2 top-2">{t('admin.cover')}</Badge>}
            <span className="absolute end-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
              <span className="grid size-7 cursor-grab place-items-center rounded-full bg-surface/90 shadow">
                <GripVertical className="size-3.5" />
              </span>
              <button type="button" onClick={() => onChange(images.filter((_, k) => k !== i))} className="grid size-7 place-items-center rounded-full bg-surface/90 text-danger shadow" aria-label={t('common.delete')}>
                <Trash2 className="size-3.5" />
              </button>
            </span>
            {colors.length > 0 && (
              <select
                value={im.color || ''}
                onChange={(e) => onChange(images.map((x, k) => (k === i ? { ...x, color: e.target.value } : x)))}
                className="w-full border-t border-line bg-surface px-2 py-1.5 text-xs font-semibold outline-none"
                title={t('admin.image_color')}
              >
                <option value="">{t('admin.all_colors')}</option>
                {colors.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
        {Array.from({ length: busy }, (_, i) => (
          <div key={`u${i}`} className="grid aspect-square place-items-center rounded-2xl border border-dashed border-line-strong">
            <Loader2 className="size-6 animate-spin text-muted" />
          </div>
        ))}
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong text-xs font-semibold text-muted transition hover:border-ink hover:text-ink"
        >
          <ImagePlus className="size-7" strokeWidth={1.5} />
          {t('admin.add_photos')}
        </button>
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
      <p className="mt-3 text-xs text-muted">{t('admin.photos_hint')}</p>
      <div className="mt-3 flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" prefix={<Link2 className="size-4" />} className="flex-1" dir="ltr" />
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (!/^https:\/\//.test(url)) return toast({ title: t('admin.errors.url_https'), tone: 'error' });
            onChange([...images, { url, color: '' }]);
            setUrl('');
          }}
        >
          {t('common.add')}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- variants
function VariantBuilder({ form, set }) {
  const { t } = useT();
  const [colors, setColors] = useState(() => {
    const seen = new Map();
    for (const v of form.variants) if (v.color_en && !seen.has(v.color_en)) seen.set(v.color_en, { en: v.color_en, ar: v.color_ar || '', hex: v.color_hex || '#cccccc' });
    return [...seen.values()];
  });
  const [opts, setOpts] = useState(() => {
    const list = [];
    for (const v of form.variants) if (v.opt && !list.find((o) => o.value === v.opt)) list.push({ value: v.opt, price: v.price });
    return list;
  });
  const [newOpt, setNewOpt] = useState('');
  const [base, setBase] = useState(form.variants[0]?.price || '');
  const [stock, setStock] = useState(3);

  const generate = () => {
    const cs = colors.length ? colors : [null];
    const os = opts.length ? opts : [null];
    const out = [];
    for (const c of cs) {
      for (const o of os) {
        const existing = form.variants.find((v) => (v.color_en || '') === (c?.en || '') && (v.opt || '') === (o?.value || ''));
        out.push(
          existing
            ? { ...existing, color_ar: c?.ar ?? existing.color_ar, color_hex: c?.hex ?? existing.color_hex }
            : { color_en: c?.en || '', color_ar: c?.ar || '', color_hex: c?.hex || '', opt: o?.value || '', price: o?.price || base || 0, compare_at: '', stock, sku: '' },
        );
      }
    }
    set({ variants: out });
  };

  return (
    <div className="rounded-2xl bg-surface-2 p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-bold">
        <Wand2 className="size-4" /> {t('admin.builder')}
      </p>
      <p className="mb-2 text-xs font-semibold text-muted">{t('admin.colors')}</p>
      <div className="space-y-2">
        {colors.map((c, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input type="color" value={c.hex} onChange={(e) => setColors(colors.map((x, k) => (k === i ? { ...x, hex: e.target.value } : x)))} className="size-10 cursor-pointer rounded-xl border border-line-strong bg-surface p-1" />
            <Input value={c.en} onChange={(e) => setColors(colors.map((x, k) => (k === i ? { ...x, en: e.target.value } : x)))} placeholder={t('admin.name_en')} className="w-40 flex-1" />
            <Input value={c.ar} onChange={(e) => setColors(colors.map((x, k) => (k === i ? { ...x, ar: e.target.value } : x)))} placeholder={t('admin.name_ar')} className="w-40 flex-1" dir="rtl" />
            <IconButton icon={X} label={t('common.delete')} size="sm" onClick={() => setColors(colors.filter((_, k) => k !== i))} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {COMMON_COLORS.filter(([en]) => !colors.find((c) => c.en === en)).map(([en, ar, hex]) => (
          <button key={en} type="button" onClick={() => setColors([...colors, { en, ar, hex }])} className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-2.5 py-1 text-xs font-semibold hover:border-ink">
            <span className="size-3 rounded-full border border-black/10" style={{ background: hex }} /> {en}
          </button>
        ))}
        <button type="button" onClick={() => setColors([...colors, { en: '', ar: '', hex: '#888888' }])} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-muted hover:text-ink">
          <Plus className="size-3.5" /> {t('admin.custom_color')}
        </button>
      </div>

      <p className="mb-2 mt-5 text-xs font-semibold text-muted">{t('admin.options_values')}</p>
      <div className="flex flex-wrap items-center gap-2">
        {opts.map((o, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 rounded-xl border border-line-strong bg-surface py-1 pe-1 ps-3 text-sm font-semibold">
            {o.value}
            <span className="flex items-center rounded-lg bg-surface-3 px-1.5 text-xs" dir="ltr">
              $<input value={o.price} onChange={(e) => setOpts(opts.map((x, k) => (k === i ? { ...x, price: e.target.value } : x)))} className="w-14 bg-transparent py-1 outline-none" inputMode="decimal" placeholder={String(base || '0')} />
            </span>
            <button type="button" onClick={() => setOpts(opts.filter((_, k) => k !== i))} className="grid size-6 place-items-center rounded-md hover:bg-surface-3" aria-label={t('common.delete')}>
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newOpt.trim()) setOpts([...opts, { value: newOpt.trim(), price: base }]);
            setNewOpt('');
          }}
          className="flex gap-1"
        >
          <Input value={newOpt} onChange={(e) => setNewOpt(e.target.value)} placeholder="128GB, 256GB…" className="h-9 w-36" />
          <Button type="submit" size="sm" variant="secondary" icon={Plus} aria-label={t('common.add')} />
        </form>
        {['128GB', '256GB', '512GB', '1TB'].filter((v) => !opts.find((o) => o.value === v)).map((v) => (
          <button key={v} type="button" onClick={() => setOpts([...opts, { value: v, price: base }])} className="rounded-full border border-dashed border-line-strong px-2.5 py-1 text-xs font-semibold text-muted hover:border-ink hover:text-ink">
            + {v}
          </button>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <Field label={t('admin.base_price')} className="w-32">
          <Input value={base} onChange={(e) => setBase(e.target.value)} inputMode="decimal" prefix="$" dir="ltr" />
        </Field>
        <Field label={t('admin.default_stock')} className="w-28">
          <Input value={stock} onChange={(e) => setStock(Number(e.target.value) || 0)} inputMode="numeric" dir="ltr" />
        </Field>
        <Button type="button" icon={Sparkles} onClick={generate}>
          {t('admin.generate', { count: Math.max(1, colors.length) * Math.max(1, opts.length) })}
        </Button>
      </div>
    </div>
  );
}

function Variants({ form, set }) {
  const { t } = useT();
  const [builder, setBuilder] = useState(false);
  const [bulkField, setBulkField] = useState(null); // 'price' | 'stock' while the inline "set all" input is open
  const [bulkValue, setBulkValue] = useState('');
  const upd = (i, patch) => set({ variants: form.variants.map((v, k) => (k === i ? { ...v, ...patch } : v)) });
  const openBulk = (field) => {
    setBulkField((f) => (f === field ? null : field));
    setBulkValue('');
  };
  const applyBulk = () => {
    if (bulkValue === '' || Number.isNaN(Number(bulkValue))) return;
    set({ variants: form.variants.map((v) => ({ ...v, [bulkField]: bulkField === 'stock' ? Math.max(0, Math.floor(Number(bulkValue))) : bulkValue })) });
    setBulkField(null);
  };
  const total = form.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant={builder ? 'primary' : 'outline'} icon={Wand2} onClick={() => setBuilder((b) => !b)}>
          {t('admin.builder')}
        </Button>
        <Button type="button" size="sm" variant={bulkField === 'price' ? 'secondary' : 'ghost'} onClick={() => openBulk('price')}>
          {t('admin.set_all_prices')}
        </Button>
        <Button type="button" size="sm" variant={bulkField === 'stock' ? 'secondary' : 'ghost'} onClick={() => openBulk('stock')}>
          {t('admin.set_all_stock')}
        </Button>
        <span className="ms-auto text-xs text-muted">
          {t('admin.variants_count', { count: form.variants.length })} · {t('admin.stock')}: {total}
        </span>
      </div>
      {bulkField && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2 p-3 animate-fade-in">
          <span className="text-sm font-semibold">{t(`admin.bulk_${bulkField}`)}</span>
          <Input
            autoFocus
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value.replace(/[^0-9.]/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyBulk();
              }
              if (e.key === 'Escape') setBulkField(null);
            }}
            inputMode="decimal"
            prefix={bulkField === 'price' ? '$' : undefined}
            className="h-10 w-32"
            dir="ltr"
          />
          <Button type="button" size="sm" onClick={applyBulk} disabled={bulkValue === ''}>
            {t('admin.apply_all', { count: form.variants.length })}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setBulkField(null)}>
            {t('common.cancel')}
          </Button>
        </div>
      )}
      {builder && <VariantBuilder form={form} set={set} />}
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-surface-2 text-xs font-bold uppercase tracking-wider text-muted">
            <tr>
              <th className="px-3 py-2.5 text-start">{t('admin.color')}</th>
              <th className="px-3 py-2.5 text-start">{L_label(form, t)}</th>
              <th className="px-3 py-2.5 text-start">{t('admin.price')}</th>
              <th className="px-3 py-2.5 text-start">{t('admin.compare_at')}</th>
              <th className="px-3 py-2.5 text-start">{t('admin.stock')}</th>
              <th className="px-3 py-2.5 text-start">SKU</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {form.variants.map((v, i) => (
              <tr key={v.id || `n${i}`}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <input type="color" value={v.color_hex || '#cccccc'} onChange={(e) => upd(i, { color_hex: e.target.value })} className="size-8 shrink-0 cursor-pointer rounded-lg border border-line-strong bg-surface p-0.5" title={t('admin.color')} />
                    <input value={v.color_en || ''} onChange={(e) => upd(i, { color_en: e.target.value })} placeholder={t('admin.name_en')} className="w-28 rounded-lg border border-line-strong bg-surface px-2 py-1.5 outline-none focus:border-ink" />
                    <input value={v.color_ar || ''} onChange={(e) => upd(i, { color_ar: e.target.value })} placeholder={t('admin.name_ar')} className="w-24 rounded-lg border border-line-strong bg-surface px-2 py-1.5 outline-none focus:border-ink" dir="rtl" />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <input value={v.opt || ''} onChange={(e) => upd(i, { opt: e.target.value })} placeholder="256GB" className="w-28 rounded-lg border border-line-strong bg-surface px-2 py-1.5 outline-none focus:border-ink" />
                </td>
                <td className="px-3 py-2">
                  <input value={v.price} onChange={(e) => upd(i, { price: e.target.value })} inputMode="decimal" className="w-20 rounded-lg border border-line-strong bg-surface px-2 py-1.5 font-semibold outline-none focus:border-ink" dir="ltr" required />
                </td>
                <td className="px-3 py-2">
                  <input value={v.compare_at ?? ''} onChange={(e) => upd(i, { compare_at: e.target.value })} inputMode="decimal" placeholder="—" className="w-20 rounded-lg border border-line-strong bg-surface px-2 py-1.5 outline-none focus:border-ink" dir="ltr" />
                </td>
                <td className="px-3 py-2">
                  <input value={v.stock} onChange={(e) => upd(i, { stock: e.target.value.replace(/\D/g, '') })} inputMode="numeric" className={cx('w-16 rounded-lg border bg-surface px-2 py-1.5 font-semibold outline-none focus:border-ink', Number(v.stock) === 0 ? 'border-danger text-danger' : 'border-line-strong')} dir="ltr" />
                </td>
                <td className="px-3 py-2">
                  <input value={v.sku || ''} onChange={(e) => upd(i, { sku: e.target.value })} className="w-28 rounded-lg border border-line-strong bg-surface px-2 py-1.5 font-mono text-xs outline-none focus:border-ink" dir="ltr" />
                </td>
                <td className="px-2">
                  <IconButton icon={Trash2} size="sm" label={t('common.delete')} className="text-danger" disabled={form.variants.length < 2} onClick={() => set({ variants: form.variants.filter((_, k) => k !== i) })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" size="sm" variant="outline" icon={Plus} onClick={() => set({ variants: [...form.variants, { ...form.variants[form.variants.length - 1], id: undefined, stock: 0, sku: '' }] })}>
        {t('admin.add_variant')}
      </Button>
    </div>
  );
}
const L_label = (form, t) => form.opt_label_en || t('admin.option');

// ---------------------------------------------------------------- specs & compatibility
function Specs({ form, set }) {
  const { t } = useT();
  const label = (k) => {
    const x = t(`specs.${k}`);
    return x === `specs.${k}` ? k : x;
  };
  const upd = (i, patch) => set({ specs: form.specs.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  return (
    <div className="space-y-2">
      {form.specs.map((s, i) => (
        <div key={i} className="flex gap-2">
          <Select value={SPEC_KEYS.includes(s.key) ? s.key : '__custom'} onChange={(e) => upd(i, { key: e.target.value === '__custom' ? '' : e.target.value })} className="w-44 shrink-0 text-sm">
            {SPEC_KEYS.map((k) => (
              <option key={k} value={k}>
                {label(k)}
              </option>
            ))}
            <option value="__custom">{t('admin.custom')}</option>
          </Select>
          {!SPEC_KEYS.includes(s.key) && <Input value={s.key} onChange={(e) => upd(i, { key: e.target.value })} placeholder={t('admin.spec_name')} className="w-40" />}
          <Input value={s.value} onChange={(e) => upd(i, { value: e.target.value })} placeholder={t('admin.spec_value')} className="flex-1" dir="auto" />
          <IconButton icon={X} label={t('common.delete')} onClick={() => set({ specs: form.specs.filter((_, k) => k !== i) })} />
        </div>
      ))}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" size="sm" variant="outline" icon={Plus} onClick={() => set({ specs: [...form.specs, { key: 'display', value: '' }] })}>
          {t('admin.add_spec')}
        </Button>
        <Button type="button" size="sm" variant="ghost" icon={Sparkles} onClick={() => set({ specs: [...form.specs, ...PHONE_TEMPLATE.filter((k) => !form.specs.find((s) => s.key === k)).map((key) => ({ key, value: '' }))] })}>
          {t('admin.phone_template')}
        </Button>
      </div>
    </div>
  );
}

function Fits({ form, set, devices }) {
  const { t } = useT();
  const [v, setV] = useState('');
  const add = (name) => {
    const x = name.trim();
    if (x && !form.fits.includes(x)) set({ fits: [...form.fits, x] });
    setV('');
  };
  const universal = form.fits.includes('Universal');
  return (
    <div>
      <Switch checked={universal} onChange={(on) => set({ fits: on ? ['Universal', ...form.fits] : form.fits.filter((f) => f !== 'Universal') })} label={t('admin.universal')} hint={t('admin.universal_hint')} />
      <div className="mt-4 flex flex-wrap gap-1.5">
        {form.fits
          .filter((f) => f !== 'Universal')
          .map((f) => (
            <span key={f} className="inline-flex items-center gap-1 rounded-full bg-surface-3 py-1 pe-1 ps-3 text-sm font-semibold">
              {f}
              <button type="button" onClick={() => set({ fits: form.fits.filter((x) => x !== f) })} className="grid size-6 place-items-center rounded-full hover:bg-line" aria-label={t('common.delete')}>
                <X className="size-3.5" />
              </button>
            </span>
          ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add(v);
        }}
      >
        <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={t('admin.add_device')} list="sps-devices" className="flex-1" />
        <datalist id="sps-devices">
          {devices.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
        <Button type="submit" variant="secondary" icon={Plus}>
          {t('common.add')}
        </Button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- editor
export default function ProductEditor() {
  const { id } = useParams();
  const isNew = !id;
  const { t, L, lang } = useT();
  const store = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const tax = useApi('/api/admin/taxonomy');
  const { data } = useApi(isNew ? null : `/api/admin/products/${id}`, { keep: false });
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [tab, setTab] = useState('en');
  const [del, setDel] = useState(false);

  useEffect(() => {
    if (isNew) {
      setForm(structuredClone(EMPTY));
      setSaved(JSON.stringify(EMPTY));
    } else if (data?.product) {
      const p = data.product;
      const f = {
        ...EMPTY,
        ...p,
        category_id: p.category_id || '',
        brand_id: p.brand_id || '',
        deal_ends_at: p.deal_ends_at || '',
        variants: p.variants.map((v) => ({ ...v, compare_at: v.compare_at ?? '', sku: v.sku || '', color_en: v.color_en || '', color_ar: v.color_ar || '', color_hex: v.color_hex || '', opt: v.opt || '' })),
      };
      setForm(f);
      setSaved(JSON.stringify(f));
    }
  }, [isNew, data]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const dirty = form && saved !== JSON.stringify(form);

  const save = async () => {
    if (!form) return;
    setBusy(true);
    setErrors({});
    try {
      const body = { ...form, deal_ends_at: form.deal_ends_at || null, variants: form.variants.map((v) => ({ ...v, price: Number(v.price), stock: Number(v.stock) || 0, compare_at: v.compare_at === '' ? null : Number(v.compare_at) })) };
      const r = isNew ? await api('/api/admin/products', { method: 'POST', body }) : await api(`/api/admin/products/${id}`, { method: 'PUT', body });
      invalidate('/api/admin/products', '/api/products', '/api/home', '/api/bootstrap', '/api/admin/dashboard', '/api/search');
      setCache(`/api/admin/products/${r.product.id}`, r);
      toast({ title: t('admin.saved') });
      if (isNew) navigate(`/admin/products/${r.product.id}`, { replace: true });
      else {
        const f = { ...form, ...r.product, category_id: r.product.category_id || '', brand_id: r.product.brand_id || '', deal_ends_at: r.product.deal_ends_at || '', variants: r.product.variants.map((v) => ({ ...v, compare_at: v.compare_at ?? '', sku: v.sku || '', color_en: v.color_en || '', color_ar: v.color_ar || '', color_hex: v.color_hex || '', opt: v.opt || '' })) };
        setForm(f);
        setSaved(JSON.stringify(f));
      }
    } catch (e) {
      const msg = t(`admin.errors.${e.code}`) !== `admin.errors.${e.code}` ? t(`admin.errors.${e.code}`) : e.message;
      if (e.details?.field) setErrors({ [e.details.field]: msg });
      toast({ title: msg, tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const on = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });
  useEffect(() => {
    const on = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', on);
    return () => window.removeEventListener('beforeunload', on);
  }, [dirty]);

  const colorNames = useMemo(() => [...new Set((form?.variants || []).map((v) => v.color_en).filter(Boolean))], [form?.variants]);
  const devices = useMemo(() => [...new Set((store.devices || []).map((d) => d.name))], [store.devices]);

  // Live preview in the same shape as the storefront card.
  const preview = useMemo(() => {
    if (!form) return null;
    const vs = form.variants.map((v, i) => ({ ...v, id: v.id || -i - 1, price: Number(v.price) || 0, compare_at: Number(v.compare_at) > Number(v.price) ? Number(v.compare_at) : null, stock: Number(v.stock) || 0 }));
    const inStock = vs.filter((v) => v.stock > 0);
    const pool = inStock.length ? inStock : vs;
    const cheapest = pool.reduce((a, b) => (b.price < a.price ? b : a), pool[0] || { price: 0 });
    const cat = tax.data?.categories.find((c) => c.id === Number(form.category_id));
    const brand = tax.data?.brands.find((b) => b.id === Number(form.brand_id));
    const colors = [];
    for (const v of vs) if (v.color_en && !colors.find((c) => c.en === v.color_en)) colors.push({ en: v.color_en, ar: v.color_ar, hex: v.color_hex || '#ccc', family: colorFamilyClient(v.color_hex) });
    let disc = 0;
    for (const v of vs) if (v.compare_at > v.price) disc = Math.max(disc, Math.round((1 - v.price / v.compare_at) * 100));
    return {
      id: -1,
      slug: form.slug || 'preview',
      name: { en: form.name_en || t('admin.product_name'), ar: form.name_ar || form.name_en || t('admin.product_name') },
      brand: brand ? { name: brand.name } : null,
      category: cat ? { name: { en: cat.name_en, ar: cat.name_ar || cat.name_en } } : null,
      condition: form.condition,
      images: form.images,
      colors,
      variants: vs,
      price_min: cheapest.price || 0,
      price_max: Math.max(0, ...vs.map((v) => v.price)),
      compare_at: cheapest.compare_at,
      discount_pct: disc,
      in_stock: inStock.length > 0,
      is_new: isNew,
      rating: { avg: 0, count: 0 },
      opts: [],
    };
  }, [form, tax.data, isNew, t]);

  if (!form || !tax.data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96" />
      </div>
    );

  const cat = tax.data.categories.find((c) => c.id === Number(form.category_id));
  const isDevice = cat ? ['phone', 'tablet', 'wearable'].includes(cat.kind) : false;

  return (
    <div className="animate-fade-in pb-24">
      <Link to="/admin/products" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4 rtl:-scale-x-100" /> {t('admin.nav.products')}
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{isNew ? t('admin.new_product') : form.name_en}</h1>
        {!isNew && (
          <Button variant="outline" size="sm" icon={ExternalLink} href={storeHref(`/product/${form.slug}`)} target="_blank">
            {t('admin.view_store')}
          </Button>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Panel title={t('admin.basics')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('admin.name_en')} error={errors.name_en} required>
                <Input value={form.name_en} onChange={(e) => set({ name_en: e.target.value })} error={errors.name_en} />
              </Field>
              <Field label={t('admin.name_ar')}>
                <Input value={form.name_ar} onChange={(e) => set({ name_ar: e.target.value })} dir="rtl" />
              </Field>
              <Field label={t('admin.subtitle_en')} hint={t('admin.subtitle_hint')}>
                <Input value={form.subtitle_en} onChange={(e) => set({ subtitle_en: e.target.value })} />
              </Field>
              <Field label={t('admin.subtitle_ar')}>
                <Input value={form.subtitle_ar} onChange={(e) => set({ subtitle_ar: e.target.value })} dir="rtl" />
              </Field>
            </div>
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-ink-2">{t('product.description')}</span>
                <Segmented size="sm" value={tab} onChange={setTab} options={[{ value: 'en', label: 'English' }, { value: 'ar', label: 'عربي' }]} />
              </div>
              {tab === 'en' ? (
                <Textarea value={form.description_en} onChange={(e) => set({ description_en: e.target.value })} className="min-h-32" />
              ) : (
                <Textarea value={form.description_ar} onChange={(e) => set({ description_ar: e.target.value })} className="min-h-32" dir="rtl" />
              )}
            </div>
          </Panel>

          <Panel title={t('admin.photos')}>
            <Images images={form.images} onChange={(images) => set({ images })} colors={colorNames} />
          </Panel>

          <Panel title={t('admin.options_stock')}>
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <Field label={t('admin.option_label_en')} hint={t('admin.option_label_hint')}>
                <Input value={form.opt_label_en} onChange={(e) => set({ opt_label_en: e.target.value })} placeholder="Storage" />
              </Field>
              <Field label={t('admin.option_label_ar')}>
                <Input value={form.opt_label_ar} onChange={(e) => set({ opt_label_ar: e.target.value })} placeholder="السعة" dir="rtl" />
              </Field>
            </div>
            {errors.variants && <p className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{errors.variants}</p>}
            <Variants form={form} set={set} />
          </Panel>

          <Panel title={t('product.specs')}>
            <Specs form={form} set={set} />
          </Panel>

          <Panel title={t('admin.compatibility')}>
            {isDevice && (
              <Field label={t('admin.device_name')} hint={t('admin.device_hint')} className="mb-5">
                <Input value={form.device} onChange={(e) => set({ device: e.target.value })} placeholder="iPhone 17 Pro" list="sps-devices" />
              </Field>
            )}
            <p className="mb-3 text-sm text-muted">{t('admin.fits_text')}</p>
            <Fits form={form} set={set} devices={devices} />
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title={t('admin.preview')}>
            <div className="mx-auto max-w-[240px]">
              <ProductCard p={preview} />
            </div>
          </Panel>
          <Panel title={t('admin.status')}>
            <div className="space-y-4">
              <Switch checked={form.active} onChange={(v) => set({ active: v })} label={t('admin.visible')} hint={t('admin.visible_hint')} />
              <Switch checked={form.featured} onChange={(v) => set({ featured: v })} label={t('admin.featured')} hint={t('admin.featured_hint')} />
            </div>
          </Panel>
          <Panel title={t('admin.organization')}>
            <div className="space-y-4">
              <Field label={t('shop.filter.category')}>
                <Select value={form.category_id} onChange={(e) => set({ category_id: e.target.value })}>
                  <option value="">—</option>
                  {tax.data.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {lang === 'ar' ? c.name_ar || c.name_en : c.name_en}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('shop.filter.brand')}>
                <Select value={form.brand_id} onChange={(e) => set({ brand_id: e.target.value })}>
                  <option value="">—</option>
                  {tax.data.brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('product.condition')}>
                <Segmented value={form.condition} onChange={(v) => set({ condition: v })} options={['new', 'used', 'refurbished'].map((c) => ({ value: c, label: t(`conditions.${c}`) }))} className="w-full [&>button]:flex-1 [&>button]:justify-center" size="sm" />
              </Field>
              <Field label={t('product.warranty')}>
                <Input value={form.warranty_en} onChange={(e) => set({ warranty_en: e.target.value })} placeholder="1-year official warranty" />
                <Input value={form.warranty_ar} onChange={(e) => set({ warranty_ar: e.target.value })} placeholder="كفالة سنة" className="mt-2" dir="rtl" />
              </Field>
              <Field label={t('admin.deal_ends')} hint={t('admin.deal_ends_hint')}>
                <Input type="datetime-local" value={toLocalInput(form.deal_ends_at)} onChange={(e) => set({ deal_ends_at: e.target.value ? new Date(e.target.value).toISOString() : '' })} />
              </Field>
              <Field label={t('admin.tags')} hint={t('admin.tags_hint')}>
                <Input value={form.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="iphone, ايفون, pro" />
              </Field>
              <Field label={t('admin.slug')} hint={t('admin.slug_hint')}>
                <Input value={form.slug} onChange={(e) => set({ slug: e.target.value })} placeholder="iphone-17-pro" dir="ltr" />
              </Field>
            </div>
          </Panel>
          {!isNew && (
            <button type="button" onClick={() => setDel(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-danger hover:bg-danger/5">
              <Trash2 className="size-4" /> {t('admin.delete_product')}
            </button>
          )}
        </div>
      </div>

      <div className={cx('fixed inset-x-0 bottom-0 z-30 transition-transform duration-300 lg:start-64', dirty || isNew ? 'translate-y-0' : 'translate-y-full')}>
        <div className="glass mx-auto flex max-w-[1400px] items-center gap-3 border-t border-line px-4 py-3 sm:px-8">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="size-2 rounded-full bg-warn" /> {isNew ? t('admin.new_product') : t('admin.unsaved')}
          </span>
          <span className="flex-1" />
          {!isNew && (
            <Button variant="ghost" onClick={() => setForm(JSON.parse(saved))}>
              {t('admin.discard')}
            </Button>
          )}
          <Button onClick={save} loading={busy}>
            {isNew ? t('admin.create_product') : t('common.save')}
          </Button>
        </div>
      </div>
      <Confirm
        open={del}
        title={t('admin.delete_product_q')}
        text={form.name_en}
        onClose={() => setDel(false)}
        onConfirm={async () => {
          await api(`/api/admin/products/${id}`, { method: 'DELETE' });
          invalidate('/api/admin/products', '/api/products', '/api/home', '/api/bootstrap');
          navigate('/admin/products', { replace: true });
        }}
      />
    </div>
  );
}

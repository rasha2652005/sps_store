import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2, X, Store, Truck, Wallet, Banknote, Home, FileText, Users, KeyRound, Database, Lock, Download, ShieldCheck } from 'lucide-react';
import { api, invalidate, setCache, useApi } from '../lib/api.js';
import { useT } from '../lib/prefs.jsx';
import { useToast } from '../lib/toast.jsx';
import { Badge, Button, Field, IconButton, Img, Input, Select, Skeleton, Switch, Textarea, cx } from '../components/ui.jsx';
import { Confirm, PageHeader, Panel, resizeImage } from './kit.jsx';

const TABS = [
  ['store', Store],
  ['delivery', Truck],
  ['payments', Wallet],
  ['currency', Banknote],
  ['home', Home],
  ['policies', FileText],
  ['team', Users],
  ['account', KeyRound],
  ['demo', Database],
];
const TRUST_ICONS = ['truck', 'cash', 'shield', 'swap', 'clock', 'star', 'phone', 'gift'];

function Pair({ label, en, ar, onEn, onAr, area, hint }) {
  const C = area ? Textarea : Input;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={`${label} · EN`} hint={hint}>
        <C value={en ?? ''} onChange={(e) => onEn(e.target.value)} className={area ? 'min-h-28' : ''} />
      </Field>
      <Field label={`${label} · عربي`}>
        <C value={ar ?? ''} onChange={(e) => onAr(e.target.value)} dir="rtl" className={area ? 'min-h-28' : ''} />
      </Field>
    </div>
  );
}

function SaveBar({ dirty, busy, onSave, onReset, canEdit }) {
  const { t } = useT();
  if (!canEdit)
    return (
      <p className="mt-4 flex items-center gap-2 rounded-2xl bg-surface-3 px-4 py-3 text-sm text-muted">
        <Lock className="size-4" /> {t('admin.owner_only')}
      </p>
    );
  return (
    <div className="mt-5 flex items-center justify-end gap-2">
      {dirty && (
        <Button variant="ghost" onClick={onReset}>
          {t('admin.discard')}
        </Button>
      )}
      <Button onClick={onSave} loading={busy} disabled={!dirty}>
        {t('common.save')}
      </Button>
    </div>
  );
}

function useSection(all, key) {
  const [v, setV] = useState(() => structuredClone(all[key]));
  const [orig, setOrig] = useState(() => JSON.stringify(all[key]));
  useEffect(() => {
    setV(structuredClone(all[key]));
    setOrig(JSON.stringify(all[key]));
  }, [all, key]);
  return { v, setV, set: (patch) => setV((x) => ({ ...x, ...patch })), dirty: JSON.stringify(v) !== orig, reset: () => setV(JSON.parse(orig)) };
}

function SectionForm({ all, section, canEdit, children }) {
  const { t } = useT();
  const toast = useToast();
  const s = useSection(all, section);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await api(`/api/admin/settings/${section}`, { method: 'PUT', body: s.v });
      setCache('/api/admin/settings', { ...r, defaults: undefined });
      invalidate('/api/bootstrap', '/api/home', '/api/admin/settings');
      toast({ title: t('admin.saved') });
    } catch (e) {
      toast({ title: t(`admin.errors.${e.code}`) !== `admin.errors.${e.code}` ? t(`admin.errors.${e.code}`) : e.message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {children(s)}
      <SaveBar dirty={s.dirty} busy={busy} onSave={save} onReset={s.reset} canEdit={canEdit} />
    </>
  );
}

function HeroEditor({ slides, onChange }) {
  const { t, L } = useT();
  const toast = useToast();
  const { data } = useApi('/api/products?limit=60&sort=newest');
  const products = data?.items || [];
  const upd = (i, patch) => onChange(slides.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= slides.length) return;
    const n = [...slides];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  const upload = async (i, file) => {
    try {
      const data = await resizeImage(file, 1400);
      const r = await api('/api/admin/uploads', { method: 'POST', body: { data_url: data } });
      upd(i, { image: r.url });
    } catch {
      toast({ title: t('admin.errors.image_invalid'), tone: 'error' });
    }
  };
  return (
    <div className="space-y-4">
      {slides.map((s, i) => {
        const p = products.find((x) => x.slug === s.product_slug);
        const img = s.image || (p?.images.find((x) => x.color === s.color) || p?.images[0])?.url;
        return (
          <div key={i} className="rounded-2xl border border-line p-4">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-full bg-inverse text-sm font-bold text-on-inverse">{i + 1}</span>
              <span className="flex-1 truncate font-semibold">{L(s, 'title') || t('admin.slide')}</span>
              <IconButton icon={ArrowUp} size="sm" label="Up" onClick={() => move(i, -1)} />
              <IconButton icon={ArrowDown} size="sm" label="Down" onClick={() => move(i, 1)} />
              <IconButton icon={Trash2} size="sm" label={t('common.delete')} className="text-danger" onClick={() => onChange(slides.filter((_, k) => k !== i))} />
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
              <div className="space-y-3">
                <Pair label={t('admin.eyebrow')} en={s.eyebrow_en} ar={s.eyebrow_ar} onEn={(v) => upd(i, { eyebrow_en: v })} onAr={(v) => upd(i, { eyebrow_ar: v })} />
                <Pair label={t('admin.title')} en={s.title_en} ar={s.title_ar} onEn={(v) => upd(i, { title_en: v })} onAr={(v) => upd(i, { title_ar: v })} />
                <Pair label={t('admin.subtitle')} en={s.subtitle_en} ar={s.subtitle_ar} onEn={(v) => upd(i, { subtitle_en: v })} onAr={(v) => upd(i, { subtitle_ar: v })} />
                <Pair label={t('admin.button')} en={s.cta_en} ar={s.cta_ar} onEn={(v) => upd(i, { cta_en: v })} onAr={(v) => upd(i, { cta_ar: v })} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label={t('admin.product')}>
                    <Select value={s.product_slug || ''} onChange={(e) => upd(i, { product_slug: e.target.value, link: e.target.value ? `/product/${e.target.value}` : s.link, color: '' })}>
                      <option value="">—</option>
                      {products.map((x) => (
                        <option key={x.slug} value={x.slug}>
                          {x.name.en}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t('admin.color')}>
                    <Select value={s.color || ''} onChange={(e) => upd(i, { color: e.target.value })} disabled={!p?.colors.length}>
                      <option value="">—</option>
                      {p?.colors.map((c) => (
                        <option key={c.en} value={c.en}>
                          {c.en}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t('admin.link')}>
                    <Input value={s.link || ''} onChange={(e) => upd(i, { link: e.target.value })} placeholder="/c/phones" dir="ltr" />
                  </Field>
                </div>
              </div>
              <div>
                <div className="dark relative aspect-square overflow-hidden rounded-2xl bg-[#0b0b0d]">{img ? <Img src={img} alt="" className="absolute inset-0 p-3" /> : null}</div>
                <label className="mt-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong py-2 text-xs font-semibold text-muted hover:border-ink hover:text-ink">
                  <ImagePlus className="size-4" /> {t('admin.custom_image')}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && upload(i, e.target.files[0])} />
                </label>
                {s.image && (
                  <button className="mt-1 w-full text-center text-xs text-danger" onClick={() => upd(i, { image: '' })}>
                    {t('admin.remove_image')}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {slides.length < 6 && (
        <Button variant="outline" icon={Plus} onClick={() => onChange([...slides, { eyebrow_en: '', eyebrow_ar: '', title_en: '', title_ar: '', subtitle_en: '', subtitle_ar: '', cta_en: '', cta_ar: '', link: '/shop', product_slug: '', color: '', image: '' }])}>
          {t('admin.add_slide')}
        </Button>
      )}
    </div>
  );
}

function Team({ admin }) {
  const { t, date } = useT();
  const toast = useToast();
  const { data, reload } = useApi(admin.role === 'owner' ? '/api/admin/team' : null);
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'staff' });
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  if (admin.role !== 'owner')
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-surface-3 px-4 py-3 text-sm text-muted">
        <Lock className="size-4" /> {t('admin.owner_only')}
      </p>
    );
  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api('/api/admin/team', { method: 'POST', body: f });
      setCache('/api/admin/team', r);
      setF({ name: '', email: '', password: '', role: 'staff' });
      toast({ title: t('admin.saved') });
    } catch (ex) {
      toast({ title: t(`errors.${ex.code}`) !== `errors.${ex.code}` ? t(`errors.${ex.code}`) : ex.message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5">
      <div className="divide-y divide-line rounded-2xl border border-line">
        {data?.items.map((a) => (
          <div key={a.id} className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-9 place-items-center rounded-full bg-surface-3 text-sm font-bold">{a.name.slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {a.name} {a.id === admin.id && <span className="text-xs text-muted">({t('admin.you')})</span>}
              </p>
              <p className="truncate text-xs text-muted">
                {a.email} · {a.last_login_at ? t('admin.last_login', { date: date(a.last_login_at) }) : t('admin.never_logged')}
              </p>
            </div>
            <Badge tone={a.role === 'owner' ? 'inverse' : 'neutral'}>{t(`admin.roles.${a.role}`)}</Badge>
            {a.id !== admin.id && <IconButton icon={Trash2} size="sm" label={t('common.delete')} className="text-danger" onClick={() => setDel(a)} />}
          </div>
        ))}
      </div>
      <form onSubmit={add} className="rounded-2xl bg-surface-2 p-4">
        <p className="mb-3 text-sm font-bold">{t('admin.add_member')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t('admin.your_name')} required />
          <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder={t('checkout.email')} required dir="ltr" />
          <Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder={t('account.password')} minLength={8} required dir="ltr" />
          <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="staff">{t('admin.roles.staff')}</option>
            <option value="owner">{t('admin.roles.owner')}</option>
          </Select>
        </div>
        <p className="mt-2 text-xs text-muted">{t('admin.roles_hint')}</p>
        <Button type="submit" className="mt-3" icon={Plus} loading={busy}>
          {t('admin.add_member')}
        </Button>
      </form>
      <Confirm
        open={!!del}
        title={t('admin.delete_q', { name: del?.name || '' })}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          try {
            const r = await api(`/api/admin/team/${del.id}`, { method: 'DELETE' });
            setCache('/api/admin/team', r);
          } catch (ex) {
            toast({ title: t(`admin.errors.${ex.code}`), tone: 'error' });
          }
          setDel(null);
          reload();
        }}
      />
    </div>
  );
}

function AccountTab() {
  const { t } = useT();
  const toast = useToast();
  const [f, setF] = useState({ current: '', password: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/admin/me/password', { method: 'PUT', body: f });
      setF({ current: '', password: '' });
      toast({ title: t('admin.saved') });
    } catch (ex) {
      toast({ title: t(`errors.${ex.code}`) !== `errors.${ex.code}` ? t(`errors.${ex.code}`) : ex.message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="max-w-md space-y-4">
      <Field label={t('account.current_password')}>
        <Input type="password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required dir="ltr" />
      </Field>
      <Field label={t('account.new_password')} hint={t('account.password_hint')}>
        <Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} minLength={8} required dir="ltr" />
      </Field>
      <Button type="submit" loading={busy}>
        {t('account.change_password')}
      </Button>
    </form>
  );
}

function DemoTab({ admin }) {
  const { t } = useT();
  const toast = useToast();
  const { data, reload } = useApi('/api/admin/demo');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="max-w-xl">
      <div className="mb-8 rounded-2xl border border-line p-5">
        <p className="flex items-center gap-2 font-bold">
          <ShieldCheck className="size-5" /> {t('admin.backup_title')}
        </p>
        <p className="mt-1 text-sm text-muted">{t('admin.backup_text')}</p>
        <Button
          variant="secondary"
          icon={Download}
          className="mt-4"
          disabled={admin.role !== 'owner'}
          {...(__DEMO__ ? { onClick: () => toast({ title: t('admin.demo_no_backup'), tone: 'info' }) } : { href: '/api/admin/backup' })}
        >
          {t('admin.backup_download')}
        </Button>
        {admin.role !== 'owner' && <p className="mt-2 text-xs text-muted">{t('admin.backup_owner_only')}</p>}
      </div>
      <p className="mb-1 font-bold">{t('admin.demo_heading')}</p>
      <p className="text-sm text-muted">{t('admin.demo_text')}</p>
      <div className="my-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-surface-2 p-4">
          <p className="font-display text-3xl font-bold">{data?.products ?? '…'}</p>
          <p className="text-xs text-muted">{t('admin.demo_products')}</p>
        </div>
        <div className="rounded-2xl bg-surface-2 p-4">
          <p className="font-display text-3xl font-bold">{data?.orders ?? '…'}</p>
          <p className="text-xs text-muted">{t('admin.demo_orders')}</p>
        </div>
      </div>
      <Button variant="danger" icon={Trash2} disabled={admin.role !== 'owner' || !(data?.products || data?.orders)} onClick={() => setOpen(true)}>
        {t('admin.remove_demo')}
      </Button>
      <Confirm
        open={open}
        title={t('admin.remove_demo_q')}
        text={t('admin.remove_demo_text')}
        confirmLabel={t('admin.remove_demo')}
        busy={busy}
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          await api('/api/admin/demo/clear', { method: 'POST', body: {} });
          invalidate('/api/');
          setBusy(false);
          setOpen(false);
          reload();
          toast({ title: t('admin.saved') });
        }}
      />
    </div>
  );
}

export default function SettingsPage({ admin }) {
  const { tab = 'store' } = useParams();
  const navigate = useNavigate();
  const { t } = useT();
  const { data } = useApi('/api/admin/settings');
  const canEdit = admin.role === 'owner';
  const all = data?.settings;
  return (
    <div className="animate-fade-in">
      <PageHeader title={t('admin.nav.settings')} subtitle={t('admin.settings_text')} />
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
          {TABS.map(([k, Icon]) => (
            <button key={k} onClick={() => navigate(`/admin/settings/${k}`)} className={cx('flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition', tab === k ? 'bg-inverse text-on-inverse' : 'text-muted hover:bg-surface-3 hover:text-ink')}>
              <Icon className="size-4" /> {t(`admin.settings.${k}`)}
            </button>
          ))}
        </nav>
        <div className="min-w-0">
          {!all ? (
            <Skeleton className="h-96" />
          ) : (
            <Panel title={t(`admin.settings.${tab}`)}>
              {tab === 'store' && (
                <SectionForm all={all} section="store" canEdit={canEdit}>
                  {({ v, set }) => (
                    <div className="space-y-4">
                      <Pair label={t('admin.store_name')} en={v.name_en} ar={v.name_ar} onEn={(x) => set({ name_en: x })} onAr={(x) => set({ name_ar: x })} />
                      <Pair label={t('admin.tagline')} en={v.tagline_en} ar={v.tagline_ar} onEn={(x) => set({ tagline_en: x })} onAr={(x) => set({ tagline_ar: x })} />
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label={t('admin.phone_shown')}>
                          <Input value={v.phone} onChange={(e) => set({ phone: e.target.value })} dir="ltr" />
                        </Field>
                        <Field label="WhatsApp" hint={t('admin.whatsapp_hint')}>
                          <Input value={v.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} dir="ltr" />
                        </Field>
                        <Field label={t('checkout.email')}>
                          <Input value={v.email} onChange={(e) => set({ email: e.target.value })} dir="ltr" />
                        </Field>
                      </div>
                      <Pair label={t('admin.address')} en={v.address_en} ar={v.address_ar} onEn={(x) => set({ address_en: x })} onAr={(x) => set({ address_ar: x })} />
                      <Pair label={t('contact.hours')} en={v.hours_en} ar={v.hours_ar} onEn={(x) => set({ hours_en: x })} onAr={(x) => set({ hours_ar: x })} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Google Maps">
                          <Input value={v.maps_url} onChange={(e) => set({ maps_url: e.target.value })} placeholder="https://maps.app.goo.gl/…" dir="ltr" />
                        </Field>
                        <Field label="Instagram">
                          <Input value={v.instagram} onChange={(e) => set({ instagram: e.target.value })} placeholder="https://instagram.com/…" dir="ltr" />
                        </Field>
                        <Field label="Facebook">
                          <Input value={v.facebook} onChange={(e) => set({ facebook: e.target.value })} dir="ltr" />
                        </Field>
                        <Field label="TikTok">
                          <Input value={v.tiktok} onChange={(e) => set({ tiktok: e.target.value })} dir="ltr" />
                        </Field>
                      </div>
                    </div>
                  )}
                </SectionForm>
              )}
              {tab === 'delivery' && (
                <SectionForm all={all} section="delivery" canEdit={canEdit}>
                  {({ v, set }) => (
                    <div className="space-y-5">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label={t('admin.free_over')} hint={t('admin.free_over_hint')}>
                          <Input value={v.free_over} onChange={(e) => set({ free_over: e.target.value })} inputMode="decimal" prefix="$" dir="ltr" />
                        </Field>
                        <Field label={`${t('admin.eta')} · EN`}>
                          <Input value={v.eta_en} onChange={(e) => set({ eta_en: e.target.value })} />
                        </Field>
                        <Field label={`${t('admin.eta')} · عربي`}>
                          <Input value={v.eta_ar} onChange={(e) => set({ eta_ar: e.target.value })} dir="rtl" />
                        </Field>
                      </div>
                      <Switch checked={v.pickup_enabled} onChange={(x) => set({ pickup_enabled: x })} label={t('checkout.method_pickup')} hint={t('admin.pickup_hint')} />
                      <div>
                        <p className="mb-2 text-sm font-bold">{t('admin.zones')}</p>
                        <div className="space-y-2">
                          {v.zones.map((z, i) => (
                            <div key={i} className="flex flex-wrap items-center gap-2">
                              <Input value={z.en} onChange={(e) => set({ zones: v.zones.map((x, k) => (k === i ? { ...x, en: e.target.value } : x)) })} placeholder="English" className="min-w-36 flex-1" />
                              <Input value={z.ar} onChange={(e) => set({ zones: v.zones.map((x, k) => (k === i ? { ...x, ar: e.target.value } : x)) })} placeholder="عربي" className="min-w-36 flex-1" dir="rtl" />
                              <Input value={z.fee} onChange={(e) => set({ zones: v.zones.map((x, k) => (k === i ? { ...x, fee: e.target.value } : x)) })} inputMode="decimal" prefix="$" className="w-28" dir="ltr" />
                              <IconButton icon={X} label={t('common.delete')} onClick={() => set({ zones: v.zones.filter((_, k) => k !== i) })} />
                            </div>
                          ))}
                        </div>
                        <Button size="sm" variant="outline" icon={Plus} className="mt-3" onClick={() => set({ zones: [...v.zones, { id: '', en: '', ar: '', fee: 5 }] })}>
                          {t('admin.add_zone')}
                        </Button>
                      </div>
                    </div>
                  )}
                </SectionForm>
              )}
              {tab === 'payments' && (
                <SectionForm all={all} section="payments" canEdit={canEdit}>
                  {({ v, setV }) => (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-line p-4">
                        <Switch checked={v.cod.enabled} onChange={(x) => setV({ ...v, cod: { enabled: x } })} label={t('checkout.pay.cod')} hint={t('checkout.pay.cod_text')} />
                      </div>
                      {['whish', 'omt'].map((k) => (
                        <div key={k} className="space-y-3 rounded-2xl border border-line p-4">
                          <Switch checked={v[k].enabled} onChange={(x) => setV({ ...v, [k]: { ...v[k], enabled: x } })} label={t(`checkout.pay.${k}`)} hint={t('admin.transfer_hint')} />
                          {v[k].enabled && (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Field label={t('admin.account_name')}>
                                <Input value={v[k].account_name} onChange={(e) => setV({ ...v, [k]: { ...v[k], account_name: e.target.value } })} />
                              </Field>
                              <Field label={t('admin.account_number')}>
                                <Input value={v[k].account_number} onChange={(e) => setV({ ...v, [k]: { ...v[k], account_number: e.target.value } })} dir="ltr" />
                              </Field>
                            </div>
                          )}
                        </div>
                      ))}
                      <div className="rounded-2xl border border-line p-4">
                        <Switch checked={v.store.enabled} onChange={(x) => setV({ ...v, store: { enabled: x } })} label={t('checkout.pay.store')} hint={t('checkout.pay.store_text')} />
                      </div>
                      <p className="text-xs text-muted">{t('admin.cards_note')}</p>
                    </div>
                  )}
                </SectionForm>
              )}
              {tab === 'currency' && (
                <SectionForm all={all} section="currency" canEdit={canEdit}>
                  {({ v, set }) => (
                    <div className="max-w-md space-y-4">
                      <Field label={t('admin.lbp_rate')} hint={t('admin.lbp_rate_hint')}>
                        <Input value={v.lbp_rate} onChange={(e) => set({ lbp_rate: e.target.value })} inputMode="numeric" suffix="LBP / $1" dir="ltr" />
                      </Field>
                      <Switch checked={v.show_lbp} onChange={(x) => set({ show_lbp: x })} label={t('admin.show_lbp')} hint={t('admin.show_lbp_hint')} />
                    </div>
                  )}
                </SectionForm>
              )}
              {tab === 'home' && (
                <SectionForm all={all} section="home" canEdit={canEdit}>
                  {({ v, set }) => (
                    <div className="space-y-6">
                      <Pair label={t('admin.announcement')} en={v.announcement_en} ar={v.announcement_ar} onEn={(x) => set({ announcement_en: x })} onAr={(x) => set({ announcement_ar: x })} />
                      <Field label={t('admin.trending')} hint={t('admin.trending_hint')}>
                        <Input value={(v.trending || []).join(', ')} onChange={(e) => set({ trending: e.target.value.split(',').map((x) => x.trim()) })} />
                      </Field>
                      <div>
                        <p className="mb-1 text-sm font-bold">{t('admin.trust')}</p>
                        <p className="mb-3 text-xs text-muted">{t('admin.trust_hint')}</p>
                        <div className="grid gap-3 lg:grid-cols-2">
                          {(v.trust || []).map((x, i) => (
                            <div key={i} className="space-y-2 rounded-2xl border border-line p-3">
                              <Select value={x.icon} onChange={(e) => set({ trust: v.trust.map((y, k) => (k === i ? { ...y, icon: e.target.value } : y)) })}>
                                {TRUST_ICONS.map((ic) => (
                                  <option key={ic} value={ic}>
                                    {t(`admin.icons.${ic}`)}
                                  </option>
                                ))}
                              </Select>
                              <div className="grid gap-2">
                                <Input value={x.title_en} onChange={(e) => set({ trust: v.trust.map((y, k) => (k === i ? { ...y, title_en: e.target.value } : y)) })} placeholder="Title" className="font-semibold" />
                                <Input value={x.text_en} onChange={(e) => set({ trust: v.trust.map((y, k) => (k === i ? { ...y, text_en: e.target.value } : y)) })} placeholder="Text" />
                                <Input value={x.title_ar} onChange={(e) => set({ trust: v.trust.map((y, k) => (k === i ? { ...y, title_ar: e.target.value } : y)) })} placeholder="العنوان" dir="rtl" className="mt-1 font-semibold" />
                                <Input value={x.text_ar} onChange={(e) => set({ trust: v.trust.map((y, k) => (k === i ? { ...y, text_ar: e.target.value } : y)) })} placeholder="النص" dir="rtl" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-3 text-sm font-bold">{t('admin.hero')}</p>
                        <HeroEditor slides={v.hero || []} onChange={(hero) => set({ hero })} />
                      </div>
                    </div>
                  )}
                </SectionForm>
              )}
              {tab === 'policies' && (
                <SectionForm all={all} section="policies" canEdit={canEdit}>
                  {({ v, set }) => (
                    <div className="space-y-5">
                      <Pair area label={t('policies.warranty')} en={v.warranty_en} ar={v.warranty_ar} onEn={(x) => set({ warranty_en: x })} onAr={(x) => set({ warranty_ar: x })} />
                      <Pair area label={t('policies.returns')} en={v.returns_en} ar={v.returns_ar} onEn={(x) => set({ returns_en: x })} onAr={(x) => set({ returns_ar: x })} />
                      <Pair area label={t('policies.delivery')} en={v.delivery_en} ar={v.delivery_ar} onEn={(x) => set({ delivery_en: x })} onAr={(x) => set({ delivery_ar: x })} />
                    </div>
                  )}
                </SectionForm>
              )}
              {tab === 'team' && <Team admin={admin} />}
              {tab === 'account' && <AccountTab />}
              {tab === 'demo' && <DemoTab admin={admin} />}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Pencil, Plus, Tag, Trash2, Copy } from 'lucide-react';
import { api, setCache, useApi } from '../lib/api.js';
import { useT } from '../lib/prefs.jsx';
import { useMoney } from '../lib/store.jsx';
import { useToast } from '../lib/toast.jsx';
import { Badge, Button, Empty, Field, IconButton, Input, Modal, Segmented, Skeleton, Switch, useCopy } from '../components/ui.jsx';
import { Confirm, PageHeader } from './kit.jsx';

const toDate = (iso) => (iso ? iso.slice(0, 10) : '');

function CouponForm({ initial, onDone }) {
  const { t } = useT();
  const toast = useToast();
  const [f, setF] = useState({ code: '', type: 'percent', value: 10, min_subtotal: 0, starts_at: '', ends_at: '', usage_limit: '', per_customer_limit: '', active: true, ...initial, starts_at: toDate(initial?.starts_at), ends_at: toDate(initial?.ends_at) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState({});
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr({});
    try {
      const body = { ...f, starts_at: f.starts_at ? new Date(`${f.starts_at}T00:00:00`).toISOString() : null, ends_at: f.ends_at ? new Date(`${f.ends_at}T23:59:59`).toISOString() : null };
      const r = initial?.id ? await api(`/api/admin/coupons/${initial.id}`, { method: 'PUT', body }) : await api('/api/admin/coupons', { method: 'POST', body });
      setCache('/api/admin/coupons', r);
      toast({ title: t('admin.saved') });
      onDone();
    } catch (ex) {
      setErr({ [ex.details?.field || 'code']: t(`admin.errors.${ex.code}`) !== `admin.errors.${ex.code}` ? t(`admin.errors.${ex.code}`) : ex.message });
    } finally {
      setBusy(false);
    }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? e.target.value : e });
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t('admin.code')} error={err.code} hint={t('admin.code_hint')}>
        <div className="flex gap-2">
          <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, '') })} className="flex-1 font-mono uppercase" error={err.code} required dir="ltr" />
          <Button type="button" variant="secondary" onClick={() => setF({ ...f, code: `SPS${Math.random().toString(36).slice(2, 7).toUpperCase()}` })}>
            {t('admin.random')}
          </Button>
        </div>
      </Field>
      <Field label={t('admin.discount_type')}>
        <Segmented
          value={f.type}
          onChange={set('type')}
          options={[
            { value: 'percent', label: '%' },
            { value: 'fixed', label: '$' },
            { value: 'shipping', label: t('admin.free_delivery') },
          ]}
        />
      </Field>
      {f.type !== 'shipping' && (
        <Field label={t('admin.value')} error={err.value}>
          <Input value={f.value} onChange={set('value')} inputMode="decimal" suffix={f.type === 'percent' ? '%' : '$'} dir="ltr" />
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('admin.min_order')}>
          <Input value={f.min_subtotal} onChange={set('min_subtotal')} inputMode="decimal" prefix="$" dir="ltr" />
        </Field>
        <Field label={t('admin.usage_limit')} hint={t('admin.empty_unlimited')}>
          <Input value={f.usage_limit ?? ''} onChange={set('usage_limit')} inputMode="numeric" dir="ltr" />
        </Field>
        <Field label={t('admin.starts')}>
          <Input type="date" value={f.starts_at} onChange={set('starts_at')} />
        </Field>
        <Field label={t('admin.ends')}>
          <Input type="date" value={f.ends_at} onChange={set('ends_at')} />
        </Field>
        <Field label={t('admin.per_customer')} hint={t('admin.per_customer_hint')}>
          <Input value={f.per_customer_limit ?? ''} onChange={set('per_customer_limit')} inputMode="numeric" dir="ltr" />
        </Field>
      </div>
      <Switch checked={f.active} onChange={(v) => setF({ ...f, active: v })} label={t('admin.active')} />
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

export default function Coupons() {
  const { t, date } = useT();
  const m = useMoney();
  const toast = useToast();
  const [copy] = useCopy();
  const { data } = useApi('/api/admin/coupons');
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const expired = (c) => c.ends_at && c.ends_at < new Date().toISOString();
  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('admin.nav.coupons')}
        subtitle={t('admin.coupons_text')}
        actions={
          <Button icon={Plus} onClick={() => setEdit({})}>
            {t('admin.new_coupon')}
          </Button>
        }
      />
      {!data ? (
        <Skeleton className="h-48" />
      ) : !data.items.length ? (
        <Empty icon={Tag} title={t('admin.no_coupons')} text={t('admin.no_coupons_text')} className="card">
          <Button icon={Plus} onClick={() => setEdit({})}>
            {t('admin.new_coupon')}
          </Button>
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map((c) => (
            <div key={c.id} className="card relative overflow-hidden p-5">
              <div className="absolute -end-6 top-1/2 size-12 -translate-y-1/2 rounded-full bg-bg" />
              <div className="absolute -start-6 top-1/2 size-12 -translate-y-1/2 rounded-full bg-bg" />
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() => {
                    copy(c.code);
                    toast({ title: t('common.copied'), tone: 'info' });
                  }}
                  className="flex items-center gap-2 font-mono text-xl font-bold tracking-wide"
                  dir="ltr"
                >
                  {c.code} <Copy className="size-4 text-muted" />
                </button>
                {!c.active ? <Badge tone="neutral">{t('admin.inactive')}</Badge> : expired(c) ? <Badge tone="danger">{t('admin.expired')}</Badge> : <Badge tone="ok">{t('admin.active')}</Badge>}
              </div>
              <p className="mt-2 font-display text-3xl font-bold">{c.type === 'percent' ? `-${c.value}%` : c.type === 'fixed' ? `-${m.usd(c.value)}` : t('admin.free_delivery')}</p>
              <div className="mt-4 space-y-1 border-t border-dashed border-line-strong pt-3 text-xs text-muted">
                {c.min_subtotal > 0 && <p>{t('admin.min_order')}: {m.usd(c.min_subtotal)}</p>}
                <p>
                  {t('admin.used')}: {c.used_count}
                  {c.usage_limit ? ` / ${c.usage_limit}` : ''}
                </p>
                {c.ends_at && <p>{t('admin.ends')}: {date(c.ends_at)}</p>}
              </div>
              <div className="mt-3 flex justify-end gap-1">
                <IconButton icon={Pencil} size="sm" label={t('common.edit')} onClick={() => setEdit(c)} />
                <IconButton icon={Trash2} size="sm" label={t('common.delete')} className="text-danger" onClick={() => setDel(c)} />
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? t('admin.edit_coupon') : t('admin.new_coupon')}>
        {edit && <CouponForm initial={edit} onDone={() => setEdit(null)} />}
      </Modal>
      <Confirm
        open={!!del}
        title={t('admin.delete_q', { name: del?.code || '' })}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          const r = await api(`/api/admin/coupons/${del.id}`, { method: 'DELETE' });
          setCache('/api/admin/coupons', r);
          setDel(null);
        }}
      />
    </div>
  );
}

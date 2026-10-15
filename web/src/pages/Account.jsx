import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ChevronRight, Heart, LogOut, MapPin, MessageCircle, Package, Pencil, Plus, Trash2, User, KeyRound } from 'lucide-react';
import { api, invalidate, setCache, useApi } from '../lib/api.js';
import { useT } from '../lib/prefs.jsx';
import { useMoney, useStore, useWhatsApp } from '../lib/store.jsx';
import { useAuth, useLists } from '../lib/account.jsx';
import { useToast } from '../lib/toast.jsx';
import { useTitle } from '../lib/ui.jsx';
import { Badge, Button, Checkbox, Empty, Field, Img, Input, Modal, Select, Skeleton, Tabs, cx } from '../components/ui.jsx';
import { Mark } from '../components/brand/Logo.jsx';

const STATUS_TONE = { pending: 'warn', confirmed: 'info', shipped: 'info', ready: 'info', delivered: 'ok', cancelled: 'danger' };

function AuthForms() {
  const { t } = useT();
  const auth = useAuth();
  const wa = useWhatsApp();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const next = sp.get('next');
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ login: '', password: '', name: '', phone: '', email: '' });
  const [state, setState] = useState({ busy: false, error: '', field: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: '', field: '' });
    try {
      if (mode === 'login') await auth.login(f.login, f.password);
      else await auth.register({ name: f.name, phone: f.phone, email: f.email, password: f.password });
      invalidate('/api/account');
      if (next && next.startsWith('/')) navigate(next, { replace: true });
    } catch (err) {
      setState({ busy: false, error: t(`errors.${err.code}`) !== `errors.${err.code}` ? t(`errors.${err.code}`) : err.message, field: err.details?.field || '' });
      return;
    }
    setState({ busy: false, error: '', field: '' });
  };
  return (
    <div className="wrap grid max-w-5xl animate-fade-in gap-6 pt-10 lg:grid-cols-2">
      <div className="dark panels relative hidden overflow-hidden rounded-[32px] bg-[#0b0b0d] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <Mark className="h-12 w-auto self-start" />
        <div>
          <h2 className="font-display text-4xl font-bold leading-tight tracking-tight">{mode === 'login' ? t('account.login_title') : t('account.register_title')}</h2>
          <p className="mt-3 text-white/60">{mode === 'login' ? t('account.login_text') : t('account.register_text')}</p>
        </div>
        <div className="pointer-events-none absolute -bottom-24 -end-24 size-80 rounded-full bg-white/10 blur-[100px]" />
      </div>
      <div className="card p-6 sm:p-10">
        {__DEMO__ && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed border-warn/60 bg-warn/10 p-4 text-sm">
            <p className="min-w-0 flex-1">{t('account.demo_admin_hint')}</p>
            <Button size="sm" to="/admin">
              {t('account.demo_admin_button')}
            </Button>
          </div>
        )}
        <Tabs
          value={mode}
          onChange={(v) => {
            setMode(v);
            setState({ busy: false, error: '', field: '' });
          }}
          items={[
            { value: 'login', label: t('account.login') },
            { value: 'register', label: t('account.register') },
          ]}
          className="mb-7"
        />
        <h1 className="font-display text-2xl font-bold lg:hidden">{mode === 'login' ? t('account.login_title') : t('account.register_title')}</h1>
        <form onSubmit={submit} className="mt-4 space-y-4 lg:mt-0">
          {mode === 'login' ? (
            <Field label={t('account.login_field')}>
              <Input value={f.login} onChange={set('login')} autoComplete="username" required dir="ltr" />
            </Field>
          ) : (
            <>
              <Field label={t('checkout.name')} error={state.field === 'name' && state.error}>
                <Input value={f.name} onChange={set('name')} autoComplete="name" required />
              </Field>
              <Field label={t('checkout.phone')} error={state.field === 'phone' && state.error}>
                <Input value={f.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" placeholder="70 123 456" required dir="ltr" />
              </Field>
              <Field label={`${t('checkout.email')} (${t('common.optional')})`} error={state.field === 'email' && state.error}>
                <Input value={f.email} onChange={set('email')} type="email" autoComplete="email" dir="ltr" />
              </Field>
            </>
          )}
          <Field label={t('account.password')} hint={mode === 'register' ? t('account.password_hint') : undefined} error={state.field === 'password' && state.error}>
            <Input value={f.password} onChange={set('password')} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'register' ? 8 : undefined} dir="ltr" />
          </Field>
          {state.error && !state.field && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{state.error}</p>}
          <Button type="submit" size="lg" block loading={state.busy}>
            {mode === 'login' ? t('account.login') : t('account.register')}
          </Button>
        </form>
        {mode === 'login' && (
          <div className="mt-6 rounded-2xl bg-surface-2 p-4 text-sm">
            <p className="font-semibold">{t('account.forgot')}</p>
            <p className="mt-1 text-muted">{t('account.forgot_text')}</p>
            {wa() && (
              <a href={wa('Hi! I forgot my password.')} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 font-semibold text-wa">
                <MessageCircle className="size-4" /> WhatsApp
              </a>
            )}
          </div>
        )}
        <p className="mt-6 text-sm text-muted">
          {t('account.guest_orders')}{' '}
          <Link to="/track" className="font-semibold text-ink underline underline-offset-4">
            {t('nav.track')}
          </Link>
        </p>
      </div>
    </div>
  );
}

function Orders() {
  const { t, date } = useT();
  const m = useMoney();
  const { data, loading } = useApi('/api/account/orders');
  if (loading) return <Skeleton className="h-40" />;
  if (!data?.items?.length)
    return (
      <Empty icon={Package} title={t('account.no_orders')} text={t('account.no_orders_text')}>
        <Button to="/shop">{t('cart.start')}</Button>
      </Empty>
    );
  return (
    <div className="space-y-3">
      {data.items.map((o) => (
        <Link key={o.number} to={`/order/${o.number}?key=${o.key}`} className="card flex items-center gap-4 p-4 transition hover:border-ink sm:p-5">
          <div className="flex -space-x-3 rtl:space-x-reverse">
            {o.images.slice(0, 3).map((im, k) => (
              <Img thumb key={k} src={im} alt="" className="size-14 rounded-2xl border-2 border-surface silver p-1" />
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold">#{o.number}</p>
            <p className="text-sm text-muted">
              {date(o.created_at)} · {t('common.items', { count: o.items })}
            </p>
          </div>
          <div className="text-end">
            <Badge tone={STATUS_TONE[o.status]}>{t(`order.statuses.${o.status}`)}</Badge>
            <p dir="ltr" className="mt-1 font-bold tabular-nums">
              {m.fmt(o.total)}
            </p>
          </div>
          <ChevronRight className="size-4 text-muted rtl:rotate-180" />
        </Link>
      ))}
    </div>
  );
}

export function AddressForm({ initial, onSaved, onCancel }) {
  const { t, L } = useT();
  const store = useStore();
  const [f, setF] = useState(() => ({ label: '', zone: '', city: '', street: '', building: '', floor: '', details: '', is_default: false, ...initial }));
  const [state, setState] = useState({ busy: false, error: '', field: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: '', field: '' });
    try {
      const me = initial?.id ? await api(`/api/account/addresses/${initial.id}`, { method: 'PUT', body: f }) : await api('/api/account/addresses', { method: 'POST', body: f });
      onSaved(me);
    } catch (err) {
      setState({ busy: false, error: t(`errors.${err.code}`), field: err.details?.field || '' });
    }
  };
  const err = (k) => (state.field === k ? state.error : undefined);
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label={`${t('account.label')} (${t('common.optional')})`} className="sm:col-span-2">
        <Input value={f.label || ''} onChange={set('label')} placeholder={t('account.label_placeholder')} />
      </Field>
      <Field label={t('checkout.zone')} error={err('zone')}>
        <Select value={f.zone} onChange={set('zone')} error={err('zone')}>
          <option value="">{t('checkout.choose_zone')}</option>
          {store.settings.delivery.zones.map((z) => (
            <option key={z.id} value={z.id}>
              {L(z)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('checkout.city')} error={err('city')}>
        <Input value={f.city} onChange={set('city')} error={err('city')} />
      </Field>
      <Field label={t('checkout.street')} error={err('street')} className="sm:col-span-2">
        <Input value={f.street} onChange={set('street')} error={err('street')} />
      </Field>
      <Field label={t('checkout.building')}>
        <Input value={f.building || ''} onChange={set('building')} />
      </Field>
      <Field label={t('checkout.floor')}>
        <Input value={f.floor || ''} onChange={set('floor')} />
      </Field>
      <Field label={t('checkout.details')} className="sm:col-span-2">
        <Input value={f.details || ''} onChange={set('details')} placeholder={t('checkout.details_placeholder')} />
      </Field>
      <Checkbox checked={!!f.is_default} onChange={(v) => setF((x) => ({ ...x, is_default: v }))} label={t('account.make_default')} className="sm:col-span-2" />
      {state.error && !state.field && <p className="text-sm text-danger sm:col-span-2">{state.error}</p>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={state.busy}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}

function Addresses() {
  const { t, L } = useT();
  const auth = useAuth();
  const store = useStore();
  const [editing, setEditing] = useState(null);
  const zones = store.settings.delivery.zones;
  const remove = async (id) => {
    const me = await api(`/api/account/addresses/${id}`, { method: 'DELETE' });
    auth.set(me);
  };
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {auth.addresses.map((a) => (
          <div key={a.id} className="card flex flex-col p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="flex items-center gap-2 font-bold">
                <MapPin className="size-4 text-muted" /> {a.label || L(zones.find((z) => z.id === a.zone)) || a.zone}
              </p>
              {a.is_default ? <Badge tone="inverse">{t('account.default')}</Badge> : null}
            </div>
            <p className="mt-2 flex-1 text-sm text-ink-2">
              {L(zones.find((z) => z.id === a.zone))}, {a.city}
              <br />
              {[a.street, a.building, a.floor].filter(Boolean).join(', ')}
              {a.details && <span className="block text-muted">{a.details}</span>}
            </p>
            <div className="mt-4 flex gap-2">
              <Button size="xs" variant="secondary" icon={Pencil} onClick={() => setEditing(a)}>
                {t('common.edit')}
              </Button>
              <Button size="xs" variant="ghost" icon={Trash2} className="text-danger" onClick={() => remove(a.id)}>
                {t('common.delete')}
              </Button>
            </div>
          </div>
        ))}
        <button onClick={() => setEditing({})} className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-[1.25rem] border-2 border-dashed border-line-strong text-sm font-semibold text-muted transition hover:border-ink hover:text-ink">
          <Plus className="size-6" /> {t('account.add_address')}
        </button>
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t('account.edit_address') : t('account.add_address')}>
        {editing && (
          <AddressForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSaved={(me) => {
              auth.set(me);
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function Profile() {
  const { t } = useT();
  const auth = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ name: auth.customer.name, email: auth.customer.email || '' });
  const [pw, setPw] = useState({ current: '', password: '' });
  const [busy, setBusy] = useState('');
  const save = async (e) => {
    e.preventDefault();
    setBusy('p');
    try {
      auth.set(await api('/api/account/profile', { method: 'PUT', body: f }));
      toast({ title: t('account.updated') });
    } catch (err) {
      toast({ title: t(`errors.${err.code}`), tone: 'error' });
    } finally {
      setBusy('');
    }
  };
  const change = async (e) => {
    e.preventDefault();
    setBusy('w');
    try {
      await api('/api/account/password', { method: 'PUT', body: pw });
      setPw({ current: '', password: '' });
      toast({ title: t('account.updated') });
    } catch (err) {
      toast({ title: t(`errors.${err.code}`), tone: 'error' });
    } finally {
      setBusy('');
    }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={save} className="card space-y-4 p-6">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold">
          <User className="size-5" /> {t('account.profile')}
        </h3>
        <Field label={t('checkout.name')}>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label={t('checkout.phone')} hint="🔒">
          <Input value={auth.customer.phone} disabled dir="ltr" />
        </Field>
        <Field label={t('checkout.email')}>
          <Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} type="email" dir="ltr" />
        </Field>
        <Button type="submit" loading={busy === 'p'}>
          {t('common.save')}
        </Button>
      </form>
      <form onSubmit={change} className="card space-y-4 p-6">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold">
          <KeyRound className="size-5" /> {t('account.change_password')}
        </h3>
        <Field label={t('account.current_password')}>
          <Input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" required dir="ltr" />
        </Field>
        <Field label={t('account.new_password')} hint={t('account.password_hint')}>
          <Input type="password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} autoComplete="new-password" minLength={8} required dir="ltr" />
        </Field>
        <Button type="submit" loading={busy === 'w'}>
          {t('account.change_password')}
        </Button>
      </form>
    </div>
  );
}

export default function Account() {
  const { t, date } = useT();
  const auth = useAuth();
  const lists = useLists();
  const [tab, setTab] = useState('orders');
  useTitle(t('account.title'));
  if (!auth.ready)
    return (
      <div className="wrap pt-10">
        <Skeleton className="h-64" />
      </div>
    );
  if (!auth.customer) return <AuthForms />;
  const c = auth.customer;
  const initials = c.name
    .split(' ')
    .map((x) => x[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="wrap max-w-5xl animate-fade-in pt-8">
      <div className="dark panels relative mb-6 flex flex-wrap items-center gap-5 overflow-hidden rounded-[30px] bg-[#0b0b0d] p-6 text-white sm:p-8">
        <span className="grid size-16 place-items-center rounded-2xl bg-white font-display text-2xl font-bold text-black">{initials}</span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{t('account.hello', { name: c.name.split(' ')[0] })}</h1>
          <p className="text-sm text-white/60">
            <span dir="ltr">{c.phone}</span> · {t('account.member_since', { date: date(c.created_at) })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button to="/wishlist" variant="glass" size="sm" icon={Heart}>
            {t('nav.wishlist')} ({lists.wish.length})
          </Button>
          <Button variant="glass" size="sm" icon={LogOut} onClick={() => auth.logout()}>
            {t('account.logout')}
          </Button>
        </div>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        className="mb-6"
        items={[
          { value: 'orders', label: t('account.orders'), icon: Package },
          { value: 'addresses', label: t('account.addresses'), icon: MapPin, count: auth.addresses.length || null },
          { value: 'profile', label: t('account.profile'), icon: User },
        ]}
      />
      {tab === 'orders' && <Orders />}
      {tab === 'addresses' && <Addresses />}
      {tab === 'profile' && <Profile />}
    </div>
  );
}

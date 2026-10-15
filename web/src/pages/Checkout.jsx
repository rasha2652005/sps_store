import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Banknote, Check, ChevronDown, Lock, MapPin, Smartphone, Store, Tag, Truck, Wallet, X } from 'lucide-react';
import { api, invalidate } from '../lib/api.js';
import { useT } from '../lib/prefs.jsx';
import { useMoney, useStore } from '../lib/store.jsx';
import { readJSON, useCart, useQuote, writeJSON } from '../lib/cart.jsx';
import { useAuth } from '../lib/account.jsx';
import { useToast } from '../lib/toast.jsx';
import { useTitle } from '../lib/ui.jsx';
import { Button, Empty, Field, Img, Input, Select, Textarea, Checkbox, Spinner, cx } from '../components/ui.jsx';
import { ShoppingBag } from 'lucide-react';

const PAY_ICONS = { cod: Banknote, whish: Wallet, omt: Wallet, store: Store };

function Section({ n, title, children, aside }) {
  return (
    <section className="card p-5 sm:p-7">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 font-display text-xl font-bold">
          <span className="grid size-8 place-items-center rounded-full bg-inverse text-sm text-on-inverse">{n}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function RadioCard({ checked, onClick, icon: Icon, title, text, extra }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx('flex w-full items-start gap-3.5 rounded-2xl border p-4 text-start transition', checked ? 'border-ink bg-surface-2 ring-1 ring-ink' : 'border-line-strong hover:border-ink/50')}
      aria-pressed={checked}
    >
      <span className={cx('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 transition', checked ? 'border-ink' : 'border-line-strong')}>{checked && <span className="size-2.5 rounded-full bg-ink" />}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-semibold">
          {Icon && <Icon className="size-4 text-muted" />} {title}
        </span>
        {text && <span className="mt-0.5 block text-sm text-muted">{text}</span>}
        {checked && extra}
      </span>
    </button>
  );
}

export default function Checkout() {
  const { t, L, lang } = useT();
  const m = useMoney();
  const store = useStore();
  const cart = useCart();
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const s = store.settings;
  useTitle(t('checkout.title'));

  const saved = useMemo(() => readJSON('sps:checkout', {}), []);
  const [f, setF] = useState(() => ({
    name: saved.name || '',
    phone: saved.phone || '',
    email: saved.email || '',
    method: saved.method === 'pickup' && s.delivery.pickup_enabled ? 'pickup' : 'delivery',
    zone: saved.zone || readJSON('sps:zone', ''),
    city: saved.city || '',
    street: saved.street || '',
    building: saved.building || '',
    floor: saved.floor || '',
    details: saved.details || '',
    payment: '',
    payment_ref: '',
    notes: '',
    save_address: true,
  }));
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const [addrId, setAddrId] = useState(null);
  const [coupon, setCoupon] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [couponOpen, setCouponOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Prefill from the account.
  useEffect(() => {
    if (!auth.customer) return;
    setF((x) => ({ ...x, name: x.name || auth.customer.name, phone: x.phone || auth.customer.phone, email: x.email || auth.customer.email || '' }));
    const def = auth.addresses.find((a) => a.is_default) || auth.addresses[0];
    if (def && !saved.street) pickAddress(def);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.customer?.id]);

  function pickAddress(a) {
    setAddrId(a?.id || null);
    if (a) set({ zone: a.zone, city: a.city, street: a.street, building: a.building || '', floor: a.floor || '', details: a.details || '' });
  }

  const payOptions = useMemo(() => {
    const p = s.payments;
    const list = [];
    if (f.method === 'pickup') {
      if (p.store?.enabled) list.push('store');
    } else if (p.cod?.enabled) list.push('cod');
    if (p.whish?.enabled) list.push('whish');
    if (p.omt?.enabled) list.push('omt');
    return list;
  }, [s.payments, f.method]);
  useEffect(() => {
    if (!payOptions.includes(f.payment)) set({ payment: payOptions[0] || '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payOptions]);

  const { quote, loading } = useQuote({ zone: f.method === 'delivery' ? f.zone : null, delivery_method: f.method, coupon });
  const problems = (quote?.lines || []).filter((l) => l.problem);

  useEffect(() => {
    if (quote?.coupon && !quote.coupon.valid && coupon) {
      setErrors((e) => ({ ...e, coupon: t(`errors.${quote.coupon.problem}`) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote?.coupon?.valid, coupon]);

  if (!cart.items.length)
    return (
      <div className="wrap pt-10">
        <Empty icon={ShoppingBag} title={t('cart.empty_title')} text={t('cart.empty_text')}>
          <Button to="/shop">{t('cart.start')}</Button>
        </Empty>
      </div>
    );

  const err = (k) => errors[k];
  const submit = async (e) => {
    e?.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      const body = {
        items: cart.items.map((x) => ({ variant_id: x.variant_id, qty: x.qty })),
        coupon: coupon || undefined,
        customer: { name: f.name, phone: f.phone, email: f.email },
        delivery: { method: f.method, zone: f.zone, city: f.city, street: f.street, building: f.building, floor: f.floor, details: f.details },
        payment_method: f.payment,
        payment_ref: f.payment_ref,
        notes: f.notes,
        lang,
        save_address: f.save_address && !addrId,
      };
      const { order } = await api('/api/orders', { method: 'POST', body });
      writeJSON('sps:checkout', { name: f.name, phone: f.phone, email: f.email, method: f.method, zone: f.zone, city: f.city, street: f.street, building: f.building, floor: f.floor, details: f.details });
      cart.clear();
      invalidate('/api/home', '/api/products', '/api/account', '/api/auth');
      navigate(`/order/${order.number}?key=${order.key}&new=1`, { replace: true });
    } catch (ex) {
      const field = ex.details?.field;
      const msg = t(`errors.${ex.code}`) !== `errors.${ex.code}` ? t(`errors.${ex.code}`) : ex.message;
      if (field) {
        setErrors({ [field === 'payment_method' ? 'payment' : field]: msg });
        document.querySelector(`[name="${field === 'payment_method' ? 'payment' : field}"]`)?.focus();
      }
      toast({ title: msg, tone: 'error' });
      if (ex.code === 'cart_changed' && ex.details?.lines) cart.reconcile({ lines: ex.details.lines });
    } finally {
      setBusy(false);
    }
  };

  const fee = quote?.delivery_fee;
  const zones = s.delivery.zones;
  const total = quote?.total ?? cart.subtotal;

  const summary = (
    <div className="space-y-4">
      <div className="max-h-[42vh] space-y-3 overflow-y-auto pe-1">
        {cart.items.map((l) => {
          const pr = problems.find((x) => x.variant_id === l.variant_id);
          return (
            <div key={l.variant_id} className="flex items-center gap-3">
              <span className="relative shrink-0">
                <Img thumb src={l.image} alt="" className="size-16 rounded-2xl silver p-1" />
                <span className="absolute -end-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-inverse text-[11px] font-bold text-on-inverse">{l.qty}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 text-sm font-semibold">{L(l.name)}</span>
                <span className="block truncate text-xs text-muted">{L(l.variant)}</span>
                {pr && <span className="block text-xs font-semibold text-danger">{pr.problem === 'not_enough_stock' ? t('cart.not_enough', { count: pr.stock }) : t('cart.out_of_stock')}</span>}
              </span>
              <span dir="ltr" className="text-sm font-semibold tabular-nums">
                {m.fmt(l.price * l.qty)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="border-t border-line pt-4">
        {quote?.coupon?.valid ? (
          <div className="flex items-center justify-between rounded-2xl bg-ok/10 px-4 py-3 text-sm font-semibold text-ok">
            <span className="flex items-center gap-2">
              <Tag className="size-4" /> {t('checkout.coupon_applied', { code: quote.coupon.code })}
            </span>
            <button
              onClick={() => {
                setCoupon('');
                setCouponInput('');
              }}
              aria-label={t('common.clear')}
            >
              <X className="size-4" />
            </button>
          </div>
        ) : couponOpen ? (
          <div>
            <div className="flex gap-2">
              <Input
                value={couponInput}
                onChange={(e) => {
                  setCouponInput(e.target.value.toUpperCase());
                  setErrors((x) => ({ ...x, coupon: null }));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setCoupon(couponInput.trim());
                  }
                }}
                placeholder={t('checkout.coupon_placeholder')}
                className="flex-1 uppercase"
                name="coupon"
                error={err('coupon')}
              />
              <Button type="button" variant="secondary" onClick={() => setCoupon(couponInput.trim())}>
                {t('common.apply')}
              </Button>
            </div>
            {err('coupon') && <p className="mt-1.5 text-xs font-medium text-danger">{err('coupon')}</p>}
          </div>
        ) : (
          <button type="button" onClick={() => setCouponOpen(true)} className="flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
            <Tag className="size-4" /> {t('checkout.coupon')}
          </button>
        )}
      </div>

      <dl className="space-y-2.5 border-t border-line pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">{t('common.subtotal')}</dt>
          <dd dir="ltr" className="font-semibold tabular-nums">
            {m.fmt(quote?.subtotal ?? cart.subtotal)}
          </dd>
        </div>
        {quote?.discount > 0 && (
          <div className="flex justify-between text-ok">
            <dt>{t('checkout.discount')}</dt>
            <dd dir="ltr" className="font-semibold tabular-nums">
              −{m.fmt(quote.discount)}
            </dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted">{t('checkout.delivery_fee')}</dt>
          <dd className="font-semibold">
            {f.method === 'pickup' || fee === 0 ? <span className="text-ok">{t('common.free')}</span> : fee == null ? <span className="text-muted">{t('checkout.choose_zone_first')}</span> : <span dir="ltr">{m.fmt(fee)}</span>}
          </dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-line pt-3">
          <dt className="font-bold">{t('checkout.total')}</dt>
          <dd className="text-end">
            <span dir="ltr" className="block text-2xl font-bold tabular-nums">
              {m.fmt(total)}
            </span>
            {m.alt(total) && (
              <span dir="ltr" className="block text-xs text-muted tabular-nums">
                ≈ {m.alt(total)}
              </span>
            )}
          </dd>
        </div>
      </dl>
    </div>
  );

  return (
    <div className="wrap animate-fade-in pt-6 sm:pt-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('checkout.title')}</h1>
        <Link to="/cart" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="size-4 rtl:-scale-x-100" /> {t('checkout.back_to_cart')}
        </Link>
      </div>

      {/* mobile summary toggle */}
      <div className="card mb-4 lg:hidden">
        <button className="flex w-full items-center justify-between p-4 text-sm font-semibold" onClick={() => setSummaryOpen((o) => !o)}>
          <span className="flex items-center gap-2">
            <ShoppingBag className="size-4" /> {t('checkout.summary')} ({cart.count})
          </span>
          <span className="flex items-center gap-2">
            <span dir="ltr" className="font-bold">
              {m.fmt(total)}
            </span>
            <ChevronDown className={cx('size-4 transition', summaryOpen && 'rotate-180')} />
          </span>
        </button>
        {summaryOpen && <div className="border-t border-line p-4">{summary}</div>}
      </div>

      <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_420px]" noValidate>
        <div className="space-y-4">
          <Section
            n={1}
            title={t('checkout.contact')}
            aside={
              auth.customer ? (
                <span className="text-xs text-muted">{t('checkout.logged_as', { name: auth.customer.name })}</span>
              ) : (
                <Link to="/account?next=/checkout" className="text-sm font-semibold underline underline-offset-4">
                  {t('checkout.login')}
                </Link>
              )
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('checkout.name')} error={err('name')} required>
                <Input name="name" value={f.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" error={err('name')} />
              </Field>
              <Field label={t('checkout.phone')} error={err('phone')} hint={t('checkout.phone_hint')} required>
                <Input name="phone" value={f.phone} onChange={(e) => set({ phone: e.target.value })} inputMode="tel" autoComplete="tel" placeholder="70 123 456" prefix={<span dir="ltr">🇱🇧</span>} error={err('phone')} dir="ltr" />
              </Field>
              <Field label={`${t('checkout.email')} (${t('common.optional')})`} error={err('email')} className="sm:col-span-2">
                <Input name="email" type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} autoComplete="email" error={err('email')} dir="ltr" />
              </Field>
            </div>
          </Section>

          <Section n={2} title={t('checkout.delivery')}>
            {s.delivery.pickup_enabled && (
              <div className="mb-5 grid gap-3 sm:grid-cols-2">
                <RadioCard checked={f.method === 'delivery'} onClick={() => set({ method: 'delivery' })} icon={Truck} title={t('checkout.method_delivery')} text={t('checkout.method_delivery_text')} />
                <RadioCard checked={f.method === 'pickup'} onClick={() => set({ method: 'pickup' })} icon={Store} title={t('checkout.method_pickup')} text={t('checkout.method_pickup_text')} />
              </div>
            )}
            {f.method === 'delivery' ? (
              <div className="space-y-4">
                {auth.addresses.length > 0 && (
                  <div>
                    <p className="mb-2 text-[13px] font-semibold text-ink-2">{t('checkout.saved_addresses')}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {auth.addresses.map((a) => (
                        <RadioCard
                          key={a.id}
                          checked={addrId === a.id}
                          onClick={() => pickAddress(a)}
                          icon={MapPin}
                          title={a.label || L(zones.find((z) => z.id === a.zone)) || a.zone}
                          text={[a.city, a.street, a.building].filter(Boolean).join(', ')}
                        />
                      ))}
                      <RadioCard checked={!addrId} onClick={() => pickAddress(null)} title={t('checkout.new_address')} />
                    </div>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t('checkout.zone')} error={err('zone')} required>
                    <Select
                      name="zone"
                      value={f.zone}
                      onChange={(e) => {
                        set({ zone: e.target.value });
                        writeJSON('sps:zone', e.target.value);
                        setAddrId(null);
                      }}
                      error={err('zone')}
                    >
                      <option value="">{t('checkout.choose_zone')}</option>
                      {zones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {L(z)} — ${z.fee}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t('checkout.city')} error={err('city')} required>
                    <Input name="city" value={f.city} onChange={(e) => set({ city: e.target.value })} autoComplete="address-level2" error={err('city')} />
                  </Field>
                  <Field label={t('checkout.street')} error={err('street')} required className="sm:col-span-2">
                    <Input name="street" value={f.street} onChange={(e) => set({ street: e.target.value })} autoComplete="address-line1" error={err('street')} />
                  </Field>
                  <Field label={`${t('checkout.building')} (${t('common.optional')})`}>
                    <Input name="building" value={f.building} onChange={(e) => set({ building: e.target.value })} />
                  </Field>
                  <Field label={`${t('checkout.floor')} (${t('common.optional')})`}>
                    <Input name="floor" value={f.floor} onChange={(e) => set({ floor: e.target.value })} />
                  </Field>
                  <Field label={`${t('checkout.details')} (${t('common.optional')})`} className="sm:col-span-2">
                    <Input name="details" value={f.details} onChange={(e) => set({ details: e.target.value })} placeholder={t('checkout.details_placeholder')} />
                  </Field>
                </div>
                {auth.customer && !addrId && <Checkbox checked={f.save_address} onChange={(v) => set({ save_address: v })} label={t('checkout.save_address')} />}
                {L(s.delivery, 'eta') && (
                  <p className="flex items-center gap-2 text-sm text-muted">
                    <Truck className="size-4" /> {t('checkout.eta', { eta: L(s.delivery, 'eta') })}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-2xl bg-surface-2 p-4 text-sm">
                <MapPin className="mt-0.5 size-5 shrink-0 text-muted" />
                <div>
                  <p className="font-semibold">{store.settings.store.name_en}</p>
                  <p className="text-muted">{L(s.store, 'address')}</p>
                  {L(s.store, 'hours') && <p className="text-muted">{L(s.store, 'hours')}</p>}
                  {s.store.maps_url && (
                    <a href={s.store.maps_url} target="_blank" rel="noreferrer" className="mt-1 inline-block font-semibold underline">
                      {t('contact.directions')}
                    </a>
                  )}
                </div>
              </div>
            )}
          </Section>

          <Section n={3} title={t('checkout.payment')}>
            <div className="space-y-3" role="radiogroup">
              {payOptions.map((p) => (
                <RadioCard
                  key={p}
                  checked={f.payment === p}
                  onClick={() => set({ payment: p })}
                  icon={PAY_ICONS[p]}
                  title={t(`checkout.pay.${p}`)}
                  text={t(`checkout.pay.${p}_text`)}
                  extra={
                    (p === 'whish' || p === 'omt') && (
                      <span className="mt-3 block space-y-3" onClick={(e) => e.stopPropagation()}>
                        <span className="block rounded-xl bg-surface p-3 text-sm text-ink-2 ring-1 ring-line">
                          {t('checkout.transfer_to', {
                            amount: m.usd(total),
                            number: s.payments[p].account_number,
                            name: s.payments[p].account_name,
                          })}
                        </span>
                        <Input value={f.payment_ref} onChange={(e) => set({ payment_ref: e.target.value })} placeholder={t('checkout.payment_ref')} />
                        <span className="block text-xs text-muted">{t('checkout.payment_ref_hint')}</span>
                      </span>
                    )
                  }
                />
              ))}
            </div>
            {err('payment') && <p className="mt-2 text-xs font-medium text-danger">{err('payment')}</p>}
            <Field label={`${t('checkout.notes')} (${t('common.optional')})`} className="mt-5">
              <Textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} placeholder={t('checkout.notes_placeholder')} className="min-h-20" />
            </Field>
          </Section>

          <div className="lg:hidden">
            <Button type="submit" size="lg" block loading={busy} icon={Lock} disabled={loading && !quote}>
              {t('checkout.place_order')} · <span dir="ltr">{m.fmt(total)}</span>
            </Button>
            <p className="mt-3 text-center text-xs text-muted">{t('checkout.terms')}</p>
          </div>
        </div>

        <aside className="hidden lg:sticky lg:top-24 lg:block">
          <div className="card p-6">
            <h2 className="mb-5 flex items-center justify-between font-display text-xl font-bold">
              {t('checkout.summary')} {loading && <Spinner className="size-4" />}
            </h2>
            {summary}
            <Button type="submit" size="lg" block loading={busy} icon={Lock} className="mt-6" disabled={loading && !quote}>
              {t('checkout.place_order')}
            </Button>
            <p className="mt-3 text-center text-xs text-muted">{t('checkout.terms')}</p>
          </div>
          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted">
            <Check className="size-4" /> {t('checkout.secure')}
          </p>
        </aside>
      </form>
    </div>
  );
}

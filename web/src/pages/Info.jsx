import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeftRight, ArrowRight, BadgeCheck, Battery, Camera, Check, ChevronDown, Clock, HandCoins, MapPin, MessageCircle, Phone, Search, ShieldCheck, Smartphone, Truck, Undo2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { useT } from '../lib/prefs.jsx';
import { useMoney, useStore, useWhatsApp } from '../lib/store.jsx';
import { useTitle } from '../lib/ui.jsx';
import { Button, Field, Input, Textarea, cx } from '../components/ui.jsx';

// ---------------------------------------------------------------- trade-in
export function TradeIn() {
  const { t } = useT();
  const wa = useWhatsApp();
  useTitle(t('tradein.title'));
  const [f, setF] = useState({ device: '', storage: '', condition: 'good', battery: 90, wants: '', name: '', phone: '', notes: '' });
  const [state, setState] = useState({ busy: false, done: false, error: '', field: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, done: false, error: '', field: '' });
    try {
      await api('/api/tradeins', { method: 'POST', body: f });
      setState({ busy: false, done: true, error: '', field: '' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setState({ busy: false, done: false, error: t(`errors.${err.code}`), field: err.details?.field || '' });
    }
  };
  const err = (k) => (state.field === k ? state.error : undefined);
  const conds = ['like_new', 'good', 'fair', 'broken'];
  return (
    <div className="wrap animate-fade-in pt-6 sm:pt-8">
      <div className="dark panels relative overflow-hidden rounded-[34px] bg-[#0b0b0d] px-6 py-12 text-white sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute -end-20 -top-24 size-96 rounded-full bg-white/10 blur-[110px]" />
        <p className="eyebrow flex items-center gap-2 text-white/50">
          <ArrowLeftRight className="size-4" /> {t('tradein.eyebrow')}
        </p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-6xl">{t('tradein.title')}</h1>
        <p className="mt-4 max-w-xl text-white/65 sm:text-lg">{t('tradein.text')}</p>
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {[
            [Smartphone, t('tradein.step1')],
            [HandCoins, t('tradein.step2')],
            [ArrowLeftRight, t('tradein.step3')],
          ].map(([Icon, label], k) => (
            <div key={k} className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-4">
              <span className="grid size-10 place-items-center rounded-xl bg-white text-black">
                <Icon className="size-5" />
              </span>
              <span className="font-semibold">
                <span className="me-1.5 text-white/40">{k + 1}.</span>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-3xl">
        {state.done ? (
          <div className="card flex flex-col items-center p-10 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-ok text-white">
              <Check className="size-8" strokeWidth={2.5} />
            </span>
            <h2 className="mt-5 font-display text-2xl font-bold">{t('tradein.done_title')}</h2>
            <p className="mt-2 text-muted">{t('tradein.done_text', { phone: f.phone })}</p>
            {wa() && (
              <Button href={wa(`Trade-in: ${f.device} ${f.storage}`)} target="_blank" rel="noreferrer" variant="whatsapp" icon={MessageCircle} className="mt-6">
                {t('tradein.chat')}
              </Button>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="card space-y-6 p-6 sm:p-9">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <Field label={t('tradein.device')} error={err('device')} required>
                <Input value={f.device} onChange={set('device')} placeholder={t('tradein.device_placeholder')} error={err('device')} />
              </Field>
              <Field label={t('tradein.storage')}>
                <div className="flex flex-wrap gap-1.5">
                  {['64GB', '128GB', '256GB', '512GB', '1TB'].map((s) => (
                    <button type="button" key={s} onClick={() => set('storage')(f.storage === s ? '' : s)} className={cx('h-9 rounded-full border px-3 text-xs font-bold transition', f.storage === s ? 'border-ink bg-ink text-bg' : 'border-line-strong hover:border-ink')}>
                      {s}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <div>
              <p className="mb-2 text-[13px] font-semibold text-ink-2">{t('tradein.condition')}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {conds.map((c) => (
                  <button type="button" key={c} onClick={() => set('condition')(c)} className={cx('rounded-2xl border p-3.5 text-start transition', f.condition === c ? 'border-ink bg-surface-2 ring-1 ring-ink' : 'border-line-strong hover:border-ink/50')}>
                    <span className="block text-sm font-bold">{t(`tradein.cond.${c}`)}</span>
                    <span className="block text-xs text-muted">{t(`tradein.cond.${c}_text`)}</span>
                  </button>
                ))}
              </div>
            </div>
            <Field label={`${t('tradein.battery')}: ${f.battery}%`} hint={t('tradein.battery_hint')}>
              <div className="flex items-center gap-3">
                <Battery className="size-5 text-muted" />
                <input type="range" min={50} max={100} value={f.battery} onChange={(e) => set('battery')(Number(e.target.value))} className="w-full accent-[var(--ink)]" />
              </div>
            </Field>
            <Field label={t('tradein.wants')}>
              <Input value={f.wants} onChange={set('wants')} placeholder={t('tradein.wants_placeholder')} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('tradein.name')} error={err('name')} required>
                <Input value={f.name} onChange={set('name')} autoComplete="name" error={err('name')} />
              </Field>
              <Field label={t('tradein.phone')} error={err('phone')} required>
                <Input value={f.phone} onChange={set('phone')} inputMode="tel" placeholder="70 123 456" error={err('phone')} dir="ltr" />
              </Field>
            </div>
            <Field label={t('tradein.notes')}>
              <Textarea value={f.notes} onChange={set('notes')} className="min-h-20" />
            </Field>
            {state.error && !state.field && <p className="text-sm text-danger">{state.error}</p>}
            <Button type="submit" size="lg" block loading={state.busy} iconEnd={ArrowRight}>
              {t('tradein.submit')}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- contact
export function Contact() {
  const { t, L, raw } = useT();
  const store = useStore();
  const wa = useWhatsApp();
  const s = store.settings.store;
  const [open, setOpen] = useState(0);
  useTitle(t('contact.title'));
  const faqs = raw('contact.faq_items');
  const items = Array.isArray(faqs) ? faqs : [];
  const cards = [
    s.phone && { icon: Phone, title: t('contact.call'), text: s.phone, href: `tel:${s.phone.replace(/\s/g, '')}`, ltr: true },
    wa() && { icon: MessageCircle, title: t('contact.whatsapp'), text: s.phone, href: wa(), tone: 'bg-wa text-white', ltr: true },
    s.instagram && { icon: Camera, title: t('contact.instagram'), text: `@${s.instagram.replace(/\/$/, '').split('/').pop()}`, href: s.instagram },
    { icon: MapPin, title: t('contact.visit'), text: L(s, 'address'), href: s.maps_url || null },
  ].filter(Boolean);
  return (
    <div className="wrap max-w-5xl animate-fade-in pt-8">
      <h1 className="font-display text-4xl font-bold tracking-tight">{t('contact.title')}</h1>
      <p className="mt-2 max-w-xl text-muted">{t('contact.text')}</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, k) => {
          const Tag = c.href ? 'a' : 'div';
          return (
            <Tag key={k} href={c.href || undefined} target={c.href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="card group flex flex-col p-5 transition hover:border-ink">
              <span className={cx('grid size-12 place-items-center rounded-2xl', c.tone || 'bg-inverse text-on-inverse')}>
                <c.icon className="size-5" />
              </span>
              <span className="mt-5 font-bold">{c.title}</span>
              <span className="mt-0.5 text-sm text-muted" dir={c.ltr ? 'ltr' : undefined}>
                {c.text}
              </span>
            </Tag>
          );
        })}
      </div>
      {L(s, 'hours') && (
        <div className="card mt-3 flex items-center gap-4 p-5">
          <Clock className="size-5 text-muted" />
          <div>
            <p className="text-sm font-bold">{t('contact.hours')}</p>
            <p className="text-sm text-muted">{L(s, 'hours')}</p>
          </div>
        </div>
      )}
      <h2 className="mb-4 mt-14 font-display text-2xl font-bold">{t('contact.faq')}</h2>
      <div className="card divide-y divide-line">
        {items.map(([q, a], k) => (
          <div key={k}>
            <button onClick={() => setOpen(open === k ? -1 : k)} className="flex w-full items-center justify-between gap-4 p-5 text-start font-semibold">
              {q}
              <ChevronDown className={cx('size-5 shrink-0 text-muted transition', open === k && 'rotate-180')} />
            </button>
            {open === k && <p className="-mt-1 px-5 pb-5 text-sm leading-relaxed text-ink-2">{a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- policies
export function Policies() {
  const { t, L } = useT();
  const m = useMoney();
  const store = useStore();
  const p = store.settings.policies;
  const d = store.settings.delivery;
  useTitle(t('policies.title'));
  const blocks = [
    [ShieldCheck, t('policies.warranty'), L(p, 'warranty')],
    [Undo2, t('policies.returns'), L(p, 'returns')],
    [Truck, t('policies.delivery'), L(p, 'delivery')],
  ];
  return (
    <div className="wrap max-w-4xl animate-fade-in pt-8">
      <h1 className="font-display text-4xl font-bold tracking-tight">{t('policies.title')}</h1>
      <div className="mt-8 space-y-3">
        {blocks.map(([Icon, title, text]) =>
          text ? (
            <section key={title} className="card flex gap-4 p-6">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-inverse text-on-inverse">
                <Icon className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-xl font-bold">{title}</h2>
                <p className="mt-2 whitespace-pre-line leading-relaxed text-ink-2">{text}</p>
              </div>
            </section>
          ) : null,
        )}
      </div>
      <h2 className="mb-4 mt-12 font-display text-2xl font-bold">{t('policies.fees')}</h2>
      <div className="card overflow-hidden">
        <div className="grid grid-cols-2 border-b border-line bg-surface-2 px-5 py-3 text-xs font-bold uppercase tracking-wider text-muted">
          <span>{t('policies.zone')}</span>
          <span className="text-end">{t('policies.fee')}</span>
        </div>
        {d.zones.map((z) => (
          <div key={z.id} className="grid grid-cols-2 border-b border-line px-5 py-3.5 text-sm last:border-0">
            <span className="font-medium">{L(z)}</span>
            <span dir="ltr" className="text-end font-semibold tabular-nums">
              {m.fmt(z.fee)}
            </span>
          </div>
        ))}
      </div>
      {d.free_over > 0 && <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-ok"><BadgeCheck className="size-4" /> {t('policies.free_over', { amount: m.fmt(d.free_over) })}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- accessory finder (pick a device)
export function Finder() {
  const { t } = useT();
  const store = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  useTitle(t('nav.finder'));
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const map = new Map();
    for (const d of store.devices || []) {
      if (term && !d.name.toLowerCase().includes(term)) continue;
      if (!map.has(d.brand)) map.set(d.brand, []);
      map.get(d.brand).push(d);
    }
    return [...map.entries()];
  }, [store.devices, q]);
  return (
    <div className="wrap max-w-5xl animate-fade-in pt-8">
      <p className="eyebrow text-muted">{t('home.finder_eyebrow')}</p>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-balance">{t('home.finder_title')}</h1>
      <p className="mt-2 max-w-xl text-muted">{t('home.finder_text')}</p>
      <div className="mt-6 max-w-md">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="iPhone 17 Pro, Galaxy S25…" prefix={<Search className="size-4" />} />
      </div>
      <div className="mt-8 space-y-8">
        {groups.map(([brand, list]) => (
          <section key={brand}>
            <h2 className="mb-3 font-display text-xl font-bold">{brand}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((d) => (
                <Link key={d.name} to={`/finder/${encodeURIComponent(d.name)}`} className="card group flex items-center gap-3 p-4 transition hover:border-ink">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl silver">
                    <Smartphone className="size-5" strokeWidth={1.7} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{d.name}</span>
                    <span className="block text-xs text-muted">{t('common.products', { count: d.accessories })}</span>
                  </span>
                  <ArrowRight className="size-4 text-muted opacity-0 transition group-hover:opacity-100 rtl:-scale-x-100" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

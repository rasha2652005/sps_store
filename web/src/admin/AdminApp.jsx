import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router';
import {
  Bell,
  ChevronDown,
  ExternalLink,
  FolderTree,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Package,
  Settings,
  ShoppingCart,
  Sun,
  Tag,
  Users,
  Inbox,
  X,
} from 'lucide-react';
import { api, invalidate, setCache, useApi } from '../lib/api.js';
import { usePrefs, useT } from '../lib/prefs.jsx';
import { StoreProvider } from '../lib/store.jsx';
import { useToast } from '../lib/toast.jsx';
import { Button, Field, Input, Skeleton, cx } from '../components/ui.jsx';
import { Lockup, Mark } from '../components/brand/Logo.jsx';
import { ding } from './kit.jsx';

const Dashboard = lazy(() => import('./Dashboard.jsx'));
const Orders = lazy(() => import('./Orders.jsx'));
const OrderDetail = lazy(() => import('./Orders.jsx').then((m) => ({ default: m.OrderDetail })));
const Products = lazy(() => import('./Products.jsx'));
const ProductEditor = lazy(() => import('./ProductEditor.jsx'));
const Catalog = lazy(() => import('./Catalog.jsx'));
const Customers = lazy(() => import('./People.jsx'));
const CustomerDetail = lazy(() => import('./People.jsx').then((m) => ({ default: m.CustomerDetail })));
const Reviews = lazy(() => import('./People.jsx').then((m) => ({ default: m.Reviews })));
const Requests = lazy(() => import('./People.jsx').then((m) => ({ default: m.Requests })));
const Coupons = lazy(() => import('./Coupons.jsx'));
const SettingsPage = lazy(() => import('./Settings.jsx'));

function AuthScreen({ mode, onDone }) {
  const { t } = useT();
  const demoLogin = __DEMO__ && mode === 'login';
  const [f, setF] = useState(demoLogin ? { name: '', email: 'owner@sps.demo', password: 'demo1234' } : { name: '', email: '', password: '' });
  const [state, setState] = useState({ busy: false, error: '' });
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: '' });
    try {
      const r = await api(mode === 'setup' ? '/api/admin/setup' : '/api/admin/login', { method: 'POST', body: f });
      setCache('/api/admin/me', { admin: r.admin });
      setCache('/api/admin/setup', { needs_setup: false });
      onDone?.();
    } catch (err) {
      setState({ busy: false, error: t(`errors.${err.code}`) !== `errors.${err.code}` ? t(`errors.${err.code}`) : t(`admin.errors.${err.code}`) !== `admin.errors.${err.code}` ? t(`admin.errors.${err.code}`) : err.message });
    }
  };
  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-2">
      <div className="dark panels relative hidden overflow-hidden bg-[#0a0a0c] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Lockup className="h-auto w-48" />
        <div>
          <p className="eyebrow text-white/40">{t('admin.panel')}</p>
          <h1 className="mt-3 max-w-md font-display text-5xl font-bold leading-[1.05] tracking-tight">{t('admin.login_hero')}</h1>
        </div>
        <div className="pointer-events-none absolute -bottom-40 -end-40 size-[520px] rounded-full bg-white/10 blur-[120px]" />
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <Mark className="mb-8 h-10 w-auto lg:hidden" />
          <h2 className="font-display text-3xl font-bold tracking-tight">{mode === 'setup' ? t('admin.setup_title') : t('admin.login_title')}</h2>
          <p className="mt-2 text-sm text-muted">{mode === 'setup' ? t('admin.setup_text') : t('admin.login_text')}</p>
          {demoLogin && (
            <div className="mt-6 rounded-2xl border-2 border-dashed border-warn/60 bg-warn/10 p-4 text-sm">
              <p className="font-bold">{t('admin.demo_login_title')}</p>
              <p className="mt-1 text-ink-2">{t('admin.demo_login_text')}</p>
              <p className="mt-2 font-mono text-[13px]" dir="ltr">
                owner@sps.demo · demo1234
              </p>
            </div>
          )}
          <div className="mt-8 space-y-4">
            {mode === 'setup' && (
              <Field label={t('admin.your_name')}>
                <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required autoComplete="name" />
              </Field>
            )}
            <Field label={t('checkout.email')}>
              <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required autoComplete="username" dir="ltr" />
            </Field>
            <Field label={t('account.password')} hint={mode === 'setup' ? t('account.password_hint') : undefined}>
              <Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={mode === 'setup' ? 8 : undefined} autoComplete={mode === 'setup' ? 'new-password' : 'current-password'} dir="ltr" />
            </Field>
            {state.error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{state.error}</p>}
            <Button type="submit" size="lg" block loading={state.busy}>
              {mode === 'setup' ? t('admin.create_owner') : t('account.login')}
            </Button>
          </div>
          <Link to="/" className="mt-8 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ExternalLink className="size-4" /> {t('admin.view_store')}
          </Link>
        </form>
      </div>
    </div>
  );
}

const NAV = [
  { to: '/admin', icon: LayoutDashboard, key: 'dashboard', end: true },
  { to: '/admin/orders', icon: ShoppingCart, key: 'orders', badge: 'pending' },
  { to: '/admin/products', icon: Package, key: 'products' },
  { to: '/admin/catalog', icon: FolderTree, key: 'catalog' },
  { to: '/admin/customers', icon: Users, key: 'customers' },
  { to: '/admin/coupons', icon: Tag, key: 'coupons' },
  { to: '/admin/requests', icon: Inbox, key: 'requests', badge: 'requests' },
  { to: '/admin/reviews', icon: MessageSquare, key: 'reviews' },
  { to: '/admin/settings', icon: Settings, key: 'settings' },
];

/** Polls for new orders and alerts the team (sound, toast, browser notification, tab title). */
function usePulse() {
  const { t } = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const since = useRef(null);
  const [pulse, setPulse] = useState({ pending: 0, tradeins_new: 0, alerts_waiting: 0 });
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const p = await api(`/api/admin/pulse${since.current ? `?since=${encodeURIComponent(since.current)}` : ''}`);
        if (stop) return;
        if (since.current && p.new_orders.length) {
          ding();
          const o = p.new_orders[0];
          toast({
            title: t('admin.new_order', { number: o.number }),
            text: `${o.customer_name} · $${o.total}`,
            icon: Bell,
            duration: 8000,
            action: { label: t('admin.open'), onClick: () => navigate(`/admin/orders/${o.id}`) },
          });
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(t('admin.new_order', { number: o.number }), { body: `${o.customer_name} · $${o.total}` });
            } catch {
              /* ignore */
            }
          }
          invalidate('/api/admin/orders', '/api/admin/dashboard');
        }
        since.current = p.server_time;
        setPulse(p);
      } catch {
        /* offline: try again later */
      }
    };
    tick();
    const id = setInterval(tick, 20000);
    return () => {
      stop = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    document.title = `${pulse.pending ? `(${pulse.pending}) ` : ''}${t('admin.panel')} · SPS`;
  }, [pulse.pending, t]);
  return pulse;
}

function Layout({ admin, children }) {
  const { t, lang } = useT();
  const prefs = usePrefs();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const pulse = usePulse();
  const counts = { pending: pulse.pending, requests: pulse.tradeins_new + pulse.alerts_waiting };
  useEffect(() => {
    setOpen(false);
    setMenu(false);
  }, [location.pathname]);
  const logout = async () => {
    await api('/api/admin/logout', { method: 'POST', body: {} }).catch(() => {});
    setCache('/api/admin/me', { admin: null });
  };
  const notifOk = typeof Notification !== 'undefined' && Notification.permission === 'default';

  const sidebar = (
    <div className="dark flex h-full flex-col bg-[#0b0b0d] text-white">
      <div className="flex h-16 items-center justify-between px-5">
        <Link to="/admin" className="flex items-center gap-2.5" dir="ltr">
          <Mark className="h-7 w-auto" />
          <span className="font-display text-xs font-bold tracking-[0.25em] text-white/60">ADMIN</span>
        </Link>
        <button className="lg:hidden" onClick={() => setOpen(false)} aria-label={t('common.close')}>
          <X className="size-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {NAV.filter((n) => n.key !== 'settings' || admin.role === 'owner' || true).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              cx('group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition', isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white')
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute inset-y-2 start-0 w-1 rounded-full bg-white" />}
                <n.icon className="size-[18px]" strokeWidth={1.8} />
                <span className="flex-1">{t(`admin.nav.${n.key}`)}</span>
                {n.badge && counts[n.badge] > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-hot px-1.5 text-[11px] font-bold text-white">{counts[n.badge]}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-2 border-t border-white/10 p-3">
        {notifOk && (
          <button onClick={() => Notification.requestPermission()} className="flex w-full items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-start text-xs font-semibold text-white/70 hover:bg-white/10">
            <Bell className="size-4" /> {t('admin.enable_notifications')}
          </button>
        )}
        <Link to="/" target="_blank" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/60 hover:bg-white/5 hover:text-white">
          <ExternalLink className="size-4" /> {t('admin.view_store')}
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-bg">
      <aside data-admin-sidebar className="fixed inset-y-0 start-0 z-40 hidden w-64 lg:block print:hidden">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 start-0 w-72 animate-[fade-in_0.2s]">{sidebar}</div>
        </div>
      )}
      <div className="lg:ps-64 print:ps-0">
        <header data-admin-header className="glass sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line px-4 sm:px-6 print:hidden">
          <button className="-ms-1 grid size-10 place-items-center rounded-full hover:bg-surface-3 lg:hidden" onClick={() => setOpen(true)} aria-label={t('nav.menu')}>
            <Menu className="size-5" />
          </button>
          <div className="flex-1" />
          <button onClick={() => prefs.update({ lang: lang === 'ar' ? 'en' : 'ar' })} className="h-9 rounded-full px-3 text-sm font-semibold hover:bg-surface-3">
            {t('header.switch_lang')}
          </button>
          <button onClick={() => prefs.update({ theme: prefs.dark ? 'light' : 'dark' })} className="grid size-9 place-items-center rounded-full hover:bg-surface-3" aria-label={t('common.theme')}>
            {prefs.dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
          </button>
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2 rounded-full py-1 pe-2 ps-1 hover:bg-surface-3">
              <span className="grid size-8 place-items-center rounded-full bg-inverse text-xs font-bold text-on-inverse">{admin.name.slice(0, 1).toUpperCase()}</span>
              <span className="hidden text-sm font-semibold sm:block">{admin.name}</span>
              <ChevronDown className="size-4 text-muted" />
            </button>
            {menu && (
              <div className="card absolute end-0 top-full z-50 mt-2 w-60 overflow-hidden p-1.5 shadow-[var(--shadow-pop)] animate-scale-in">
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold">{admin.name}</p>
                  <p className="truncate text-xs text-muted">{admin.email}</p>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-muted">{t(`admin.roles.${admin.role}`)}</p>
                </div>
                <Link to="/admin/settings/account" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-surface-2">
                  <KeyRound className="size-4" /> {t('account.change_password')}
                </Link>
                <button onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-danger hover:bg-danger/5">
                  <LogOut className="size-4" /> {t('account.logout')}
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] p-4 pb-16 sm:p-6 lg:p-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}

const Fallback = () => (
  <div className="space-y-4">
    <Skeleton className="h-10 w-64" />
    <div className="grid gap-4 sm:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-28" />
      ))}
    </div>
    <Skeleton className="h-80" />
  </div>
);

export default function AdminApp() {
  const setup = useApi('/api/admin/setup', { ttl: 60000 });
  const me = useApi('/api/admin/me', { ttl: 5 * 60000 });
  if (setup.data === undefined || me.data === undefined)
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <Mark className="h-10 w-auto animate-pulse" />
      </div>
    );
  if (setup.data.needs_setup) return <AuthScreen mode="setup" />;
  if (!me.data.admin) return <AuthScreen mode="login" />;
  const admin = me.data.admin;
  return (
    <StoreProvider fallback={<div className="grid min-h-dvh place-items-center"><Mark className="h-10 w-auto animate-pulse" /></div>} errorView={() => null}>
      <Layout admin={admin}>
        <Suspense fallback={<Fallback />}>
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:id" element={<OrderDetail admin={admin} />} />
            <Route path="products" element={<Products />} />
            <Route path="products/new" element={<ProductEditor />} />
            <Route path="products/:id" element={<ProductEditor />} />
            <Route path="catalog" element={<Catalog />} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="coupons" element={<Coupons />} />
            <Route path="reviews" element={<Reviews />} />
            <Route path="requests" element={<Requests />} />
            <Route path="settings" element={<SettingsPage admin={admin} />} />
            <Route path="settings/:tab" element={<SettingsPage admin={admin} />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </Suspense>
      </Layout>
    </StoreProvider>
  );
}

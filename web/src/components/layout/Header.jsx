import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { ChevronDown, Flame, Heart, Menu, Moon, Search, ShoppingBag, Sun, User, ArrowRight, Compass, Phone, MessageCircle, Truck } from 'lucide-react';
import { Logo } from '../brand/Logo.jsx';
import { IconButton, cx } from '../ui.jsx';
import { usePrefs, useT } from '../../lib/prefs.jsx';
import { useStore } from '../../lib/store.jsx';
import { useCart } from '../../lib/cart.jsx';
import { useLists, useAuth } from '../../lib/account.jsx';
import { useUI } from '../../lib/ui.jsx';
import { categoryIcon } from '../icons.jsx';

export function AnnouncementBar() {
  const { t, L, lang } = useT();
  const prefs = usePrefs();
  const store = useStore();
  const s = store.settings;
  const text = L(s.home, 'announcement');
  return (
    <div className="relative z-40 bg-[#0b0b0d] text-white">
      <div className="wrap flex h-9 items-center justify-between gap-4 text-[12.5px]">
        <div className="hidden items-center gap-4 text-white/70 lg:flex">
          {s.store.phone && (
            <a href={`tel:${s.store.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 hover:text-white" dir="ltr">
              <Phone className="size-3.5" /> {s.store.phone}
            </a>
          )}
        </div>
        <p className="mx-auto flex min-w-0 items-center gap-2 truncate font-medium lg:mx-0">
          <Truck className="size-3.5 shrink-0 opacity-70" />
          <span className="truncate">{text}</span>
        </p>
        <div className="hidden items-center gap-1 lg:flex">
          <Link to="/track" className="rounded-full px-2.5 py-1 text-white/70 hover:bg-white/10 hover:text-white">
            {t('nav.track')}
          </Link>
          {s.currency.show_lbp && (
            <button onClick={() => prefs.update({ currency: prefs.currency === 'LBP' ? 'USD' : 'LBP' })} className="rounded-full px-2.5 py-1 font-semibold text-white/80 hover:bg-white/10 hover:text-white" title={t('common.currency')}>
              {prefs.currency === 'LBP' ? 'LBP' : 'USD $'}
            </button>
          )}
          <button onClick={() => prefs.update({ lang: lang === 'ar' ? 'en' : 'ar' })} className="rounded-full px-2.5 py-1 font-semibold text-white/80 hover:bg-white/10 hover:text-white" lang={lang === 'ar' ? 'en' : 'ar'}>
            {t('header.switch_lang')}
          </button>
        </div>
      </div>
    </div>
  );
}

function AccessoriesMenu({ onClose }) {
  const { t, L } = useT();
  const store = useStore();
  const cats = store.categories.filter((c) => c.count > 0 && c.kind !== 'phone');
  return (
    <div className="card absolute start-1/2 top-full z-50 mt-3 w-[min(720px,90vw)] -translate-x-1/2 overflow-hidden p-2 shadow-[var(--shadow-pop)] rtl:translate-x-1/2 animate-scale-in">
      <div className="grid grid-cols-[minmax(0,1fr)_240px] gap-2">
        <div className="grid grid-cols-2 gap-1 p-2">
          {cats.map((c) => {
            const Icon = categoryIcon(c.icon);
            return (
              <Link key={c.id} to={`/c/${c.slug}`} onClick={onClose} className="group flex items-center gap-3 rounded-2xl p-2.5 transition hover:bg-surface-2">
                <span className="grid size-10 place-items-center rounded-xl silver text-ink transition group-hover:scale-105">
                  <Icon className="size-5" strokeWidth={1.7} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{L(c.name)}</span>
                  <span className="block text-xs text-muted">{t('common.products', { count: c.count })}</span>
                </span>
              </Link>
            );
          })}
        </div>
        <Link to="/finder" onClick={onClose} className="panels relative flex flex-col justify-end overflow-hidden rounded-2xl bg-[#0b0b0d] p-5 text-white">
          <Compass className="absolute end-5 top-5 size-7 opacity-60" strokeWidth={1.5} />
          <p className="eyebrow text-white/50">{t('home.finder_eyebrow')}</p>
          <p className="mt-2 font-display text-lg font-bold leading-snug">{t('home.finder_title')}</p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold">
            {t('home.finder_cta')} <ArrowRight className="size-4 rtl:-scale-x-100" />
          </span>
        </Link>
      </div>
    </div>
  );
}

export function Header() {
  const { t } = useT();
  const prefs = usePrefs();
  const cart = useCart();
  const lists = useLists();
  const auth = useAuth();
  const ui = useUI();
  const location = useLocation();
  const [acc, setAcc] = useState(false);
  const accRef = useRef(null);
  const [bumpKey, setBumpKey] = useState(0);

  useEffect(() => setAcc(false), [location.pathname]);
  useEffect(() => {
    if (cart.bump) setBumpKey((k) => k + 1);
  }, [cart.bump]);
  useEffect(() => {
    if (!acc) return;
    const on = (e) => !accRef.current?.contains(e.target) && setAcc(false);
    document.addEventListener('pointerdown', on);
    return () => document.removeEventListener('pointerdown', on);
  }, [acc]);

  const navCls = ({ isActive }) =>
    cx('relative inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[14px] font-semibold transition xl:px-3.5', isActive ? 'bg-surface-3 text-ink' : 'text-ink-2 hover:bg-surface-3 hover:text-ink');

  return (
    <header className="glass sticky top-0 z-50 border-b border-line">
      <div className="wrap flex h-16 items-center gap-2 lg:h-[72px] lg:gap-4">
        <IconButton icon={Menu} label={t('nav.menu')} className="-ms-2 lg:hidden" onClick={() => ui.setMenuOpen(true)} />
        <Link to="/" className="shrink-0" aria-label="Smart Phone Store">
          <Logo />
        </Link>

        <nav className="ms-4 hidden items-center gap-1 lg:flex">
          <NavLink to="/c/phones" className={navCls}>
            {t('nav.phones')}
          </NavLink>
          <div className="relative" ref={accRef} onMouseEnter={() => setAcc(true)} onMouseLeave={() => setAcc(false)}>
            <button className={navCls({ isActive: acc })} onClick={() => setAcc((v) => !v)} aria-expanded={acc}>
              {t('nav.accessories')} <ChevronDown className={cx('size-4 transition', acc && 'rotate-180')} />
            </button>
            {acc && (
              <>
                <div className="absolute inset-x-0 top-full h-4" />
                <AccessoriesMenu onClose={() => setAcc(false)} />
              </>
            )}
          </div>
          <NavLink to="/deals" className={navCls}>
            <Flame className="size-4 text-hot" /> {t('nav.deals')}
          </NavLink>
          <NavLink to="/used" className={navCls}>
            {t('nav.used')}
          </NavLink>
          <NavLink to="/trade-in" className={navCls}>
            {t('nav.tradein')}
          </NavLink>
        </nav>

        <div className="flex-1" />

        <button
          onClick={ui.openSearch}
          className="group hidden h-11 w-[clamp(220px,24vw,340px)] items-center gap-2.5 rounded-full border border-line-strong bg-surface-2 px-4 text-start text-sm text-muted transition hover:border-ink/40 hover:bg-surface md:flex"
        >
          <Search className="size-[18px] text-ink" strokeWidth={2} />
          <span className="flex-1 truncate">{t('header.search_placeholder')}</span>
          <kbd className="hidden rounded-md border border-line-strong bg-surface px-1.5 py-0.5 font-sans text-[11px] font-semibold text-muted xl:inline">⌘K</kbd>
        </button>
        <IconButton icon={Search} label={t('nav.search')} className="md:hidden" onClick={ui.openSearch} />

        <IconButton
          icon={prefs.dark ? Sun : Moon}
          label={t('common.theme')}
          className="hidden sm:inline-flex"
          onClick={() => prefs.update({ theme: prefs.dark ? 'light' : 'dark' })}
        />
        <IconButton icon={Heart} label={t('nav.wishlist')} to="/wishlist" badge={lists.wish.length} className="hidden sm:inline-flex" />
        <IconButton icon={User} label={auth.customer ? auth.customer.name : t('nav.account')} to="/account" className="hidden lg:inline-flex" />
        <span key={bumpKey} className={cx('inline-flex', bumpKey > 0 && 'animate-bump')}>
          <IconButton icon={ShoppingBag} label={t('nav.cart')} badge={cart.count} onClick={() => cart.setOpen(true)} data-cart-target className="-me-2 lg:me-0" />
        </span>
      </div>
    </header>
  );
}

export function WhatsAppFab() {
  const store = useStore();
  const { t } = useT();
  const location = useLocation();
  const num = String(store.settings.store.whatsapp || '').replace(/\D/g, '');
  if (!num || /^\/(checkout|admin)/.test(location.pathname)) return null;
  return (
    <a
      href={`https://wa.me/${num}`}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] end-4 z-40 grid size-13 place-items-center rounded-full bg-wa text-white shadow-[0_10px_30px_-8px_rgba(31,174,85,0.7)] transition hover:scale-105 lg:bottom-6 lg:end-6"
      aria-label="WhatsApp"
      title="WhatsApp"
    >
      <MessageCircle className="relative size-6" strokeWidth={2} fill="currentColor" fillOpacity={0.15} />
      <span className="sr-only">{t('contact.whatsapp')}</span>
    </a>
  );
}

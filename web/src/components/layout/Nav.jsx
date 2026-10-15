import { Link, NavLink, useLocation } from 'react-router';
import { Flame, Heart, House, LayoutGrid, Search, ShoppingBag, User, Truck, Repeat, Compass, ShieldCheck, MessageCircle, Phone, ArrowLeftRight } from 'lucide-react';
import { Drawer, Segmented, cx } from '../ui.jsx';
import { Logo } from '../brand/Logo.jsx';
import { usePrefs, useT } from '../../lib/prefs.jsx';
import { useStore } from '../../lib/store.jsx';
import { useCart } from '../../lib/cart.jsx';
import { useLists } from '../../lib/account.jsx';
import { useUI } from '../../lib/ui.jsx';
import { categoryIcon } from '../icons.jsx';

/** App-style bottom navigation on phones. */
export function MobileNav() {
  const { t } = useT();
  const cart = useCart();
  const ui = useUI();
  const location = useLocation();
  if (/^\/(checkout|admin)/.test(location.pathname) || /^\/product\//.test(location.pathname)) return null;
  const item = 'flex flex-1 flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 text-[10.5px] font-semibold';
  const cls = ({ isActive }) => cx(item, isActive ? 'text-ink' : 'text-muted');
  return (
    <nav className="glass safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-line lg:hidden">
      <div className="flex">
        <NavLink to="/" end className={cls}>
          <House className="size-[22px]" strokeWidth={1.8} />
          {t('nav.home')}
        </NavLink>
        <NavLink to="/shop" className={cls}>
          <LayoutGrid className="size-[22px]" strokeWidth={1.8} />
          {t('nav.shop')}
        </NavLink>
        <button onClick={ui.openSearch} className={cx(item, 'text-muted')}>
          <span className="-mt-5 mb-0.5 grid size-12 place-items-center rounded-full bg-inverse text-on-inverse shadow-[var(--shadow-pop)] ring-4 ring-bg">
            <Search className="size-[22px]" strokeWidth={2} />
          </span>
          {t('nav.search')}
        </button>
        <button onClick={() => cart.setOpen(true)} className={cx(item, 'text-muted')}>
          <span className="relative" data-cart-target>
            <ShoppingBag className="size-[22px]" strokeWidth={1.8} />
            {cart.count > 0 && <span className="absolute -end-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-hot px-1 text-[9.5px] font-bold text-white">{cart.count}</span>}
          </span>
          {t('nav.cart')}
        </button>
        <NavLink to="/account" className={cls}>
          <User className="size-[22px]" strokeWidth={1.8} />
          {t('nav.account')}
        </NavLink>
      </div>
    </nav>
  );
}

export function PrefsControls({ dark: onDark }) {
  const { t, lang } = useT();
  const prefs = usePrefs();
  const store = useStore();
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className={cx('text-sm font-semibold', onDark && 'text-white/80')}>{t('common.language')}</span>
        <Segmented size="sm" value={lang} onChange={(v) => prefs.update({ lang: v })} options={[{ value: 'en', label: 'English' }, { value: 'ar', label: 'عربي' }]} />
      </div>
      {store.settings.currency.show_lbp && (
        <div className="flex items-center justify-between gap-3">
          <span className={cx('text-sm font-semibold', onDark && 'text-white/80')}>{t('common.currency')}</span>
          <Segmented size="sm" value={prefs.currency} onChange={(v) => prefs.update({ currency: v })} options={[{ value: 'USD', label: 'USD $' }, { value: 'LBP', label: 'LBP' }]} />
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className={cx('text-sm font-semibold', onDark && 'text-white/80')}>{t('common.theme')}</span>
        <Segmented
          size="sm"
          value={prefs.theme}
          onChange={(v) => prefs.update({ theme: v })}
          options={[
            { value: 'light', label: t('common.light') },
            { value: 'dark', label: t('common.dark') },
            { value: 'system', label: t('common.system') },
          ]}
        />
      </div>
    </div>
  );
}

/** Side menu on phones. */
export function MobileMenu() {
  const { t, L } = useT();
  const ui = useUI();
  const store = useStore();
  const lists = useLists();
  const s = store.settings.store;
  const close = () => ui.setMenuOpen(false);
  const link = 'flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-semibold hover:bg-surface-2';
  return (
    <Drawer open={ui.menuOpen} onClose={close} side="start" title={<Logo />} width="max-w-[360px]">
      <div className="space-y-6 p-4">
        <div className="grid grid-cols-2 gap-2">
          <Link to="/deals" onClick={close} className="flex items-center gap-2 rounded-2xl bg-hot/10 p-3 text-sm font-bold text-hot">
            <Flame className="size-5" /> {t('nav.deals')}
          </Link>
          <Link to="/trade-in" onClick={close} className="flex items-center gap-2 rounded-2xl bg-surface-3 p-3 text-sm font-bold">
            <ArrowLeftRight className="size-5" /> {t('nav.tradein')}
          </Link>
        </div>
        <div>
          <p className="eyebrow mb-2 px-3 text-muted">{t('nav.categories')}</p>
          {store.categories
            .filter((c) => c.count > 0)
            .map((c) => {
              const Icon = categoryIcon(c.icon);
              return (
                <Link key={c.id} to={`/c/${c.slug}`} onClick={close} className={link}>
                  <span className="grid size-9 place-items-center rounded-xl silver">
                    <Icon className="size-[18px]" strokeWidth={1.7} />
                  </span>
                  <span className="flex-1">{L(c.name)}</span>
                  <span className="text-xs font-medium text-muted">{c.count}</span>
                </Link>
              );
            })}
        </div>
        <div className="border-t border-line pt-4">
          <Link to="/finder" onClick={close} className={link}>
            <Compass className="size-5 text-muted" /> {t('nav.finder')}
          </Link>
          <Link to="/used" onClick={close} className={link}>
            <Repeat className="size-5 text-muted" /> {t('nav.used')}
          </Link>
          <Link to="/wishlist" onClick={close} className={link}>
            <Heart className="size-5 text-muted" /> {t('nav.wishlist')} {lists.wish.length > 0 && <span className="text-xs text-muted">({lists.wish.length})</span>}
          </Link>
          <Link to="/track" onClick={close} className={link}>
            <Truck className="size-5 text-muted" /> {t('nav.track')}
          </Link>
          <Link to="/policies" onClick={close} className={link}>
            <ShieldCheck className="size-5 text-muted" /> {t('nav.policies')}
          </Link>
          <Link to="/contact" onClick={close} className={link}>
            <Phone className="size-5 text-muted" /> {t('nav.contact')}
          </Link>
        </div>
        <div className="rounded-3xl bg-surface-2 p-4">
          <PrefsControls />
        </div>
        {s.whatsapp && (
          <a href={`https://wa.me/${s.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-full bg-wa py-3 text-sm font-bold text-white">
            <MessageCircle className="size-5" /> WhatsApp
          </a>
        )}
      </div>
    </Drawer>
  );
}

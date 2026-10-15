import { Link } from 'react-router';
import { Camera, Clock, MapPin, MessageCircle, Music2, Phone, ThumbsUp } from 'lucide-react';
import { Lockup } from '../brand/Logo.jsx';
import { useT } from '../../lib/prefs.jsx';
import { useStore } from '../../lib/store.jsx';
import { PrefsControls } from './Nav.jsx';

export function Footer() {
  const { t, L } = useT();
  const store = useStore();
  const s = store.settings.store;
  const cats = store.categories.filter((c) => c.count > 0).slice(0, 7);
  const wa = String(s.whatsapp || '').replace(/\D/g, '');
  const col = 'mb-4 eyebrow text-white/40';
  const a = 'block py-1.5 text-sm text-white/75 transition hover:text-white';
  return (
    <footer className="dark panels relative mt-20 overflow-hidden bg-[#0a0a0c] text-white">
      <div className="wrap pb-28 pt-16 lg:pb-10">
        <div className="grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="col-span-2 lg:col-span-1">
            <Lockup className="h-auto w-44 text-white" />
            <p className="mt-6 max-w-xs text-sm leading-relaxed text-white/60">{L(s, 'tagline')}</p>
            <div className="mt-6 flex gap-2">
              {s.instagram && (
                <a href={s.instagram} target="_blank" rel="noreferrer" className="grid size-10 place-items-center rounded-full bg-white/8 transition hover:bg-white/15" aria-label="Instagram" title="Instagram">
                  <Camera className="size-[18px]" />
                </a>
              )}
              {s.facebook && (
                <a href={s.facebook} target="_blank" rel="noreferrer" className="grid size-10 place-items-center rounded-full bg-white/8 transition hover:bg-white/15" aria-label="Facebook" title="Facebook">
                  <ThumbsUp className="size-[18px]" />
                </a>
              )}
              {s.tiktok && (
                <a href={s.tiktok} target="_blank" rel="noreferrer" className="grid size-10 place-items-center rounded-full bg-white/8 transition hover:bg-white/15" aria-label="TikTok" title="TikTok">
                  <Music2 className="size-[18px]" />
                </a>
              )}
              {wa && (
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="grid size-10 place-items-center rounded-full bg-wa/90 transition hover:bg-wa" aria-label="WhatsApp" title="WhatsApp">
                  <MessageCircle className="size-[18px]" />
                </a>
              )}
            </div>
          </div>
          <div>
            <p className={col}>{t('footer.shop')}</p>
            {cats.map((c) => (
              <Link key={c.id} to={`/c/${c.slug}`} className={a}>
                {L(c.name)}
              </Link>
            ))}
            <Link to="/deals" className={a}>
              {t('nav.deals')}
            </Link>
          </div>
          <div>
            <p className={col}>{t('footer.help')}</p>
            <Link to="/track" className={a}>
              {t('nav.track')}
            </Link>
            <Link to="/trade-in" className={a}>
              {t('nav.tradein')}
            </Link>
            <Link to="/finder" className={a}>
              {t('nav.finder')}
            </Link>
            <Link to="/policies" className={a}>
              {t('nav.policies')}
            </Link>
            <Link to="/contact" className={a}>
              {t('nav.contact')}
            </Link>
            <Link to="/account" className={a}>
              {t('nav.account')}
            </Link>
          </div>
          <div className="col-span-2 lg:col-span-1">
            <p className={col}>{t('nav.contact')}</p>
            <div className="space-y-3 text-sm text-white/75">
              {s.phone && (
                <a href={`tel:${s.phone.replace(/\s/g, '')}`} className="flex items-center gap-3 hover:text-white">
                  <Phone className="size-4 shrink-0 text-white/40" /> <span dir="ltr">{s.phone}</span>
                </a>
              )}
              {L(s, 'address') && (
                <p className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-white/40" /> {L(s, 'address')}
                </p>
              )}
              {L(s, 'hours') && (
                <p className="flex items-start gap-3">
                  <Clock className="mt-0.5 size-4 shrink-0 text-white/40" /> {L(s, 'hours')}
                </p>
              )}
            </div>
            <div className="mt-6 rounded-2xl bg-white/[0.06] p-4">
              <PrefsControls dark />
            </div>
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>{t('footer.rights', { year: new Date().getFullYear() })}</p>
          <p className="flex items-center gap-4">
            <span>{t('footer.pay')}</span>
            <Link to="/admin" className="hover:text-white/80">
              {t('footer.staff')}
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

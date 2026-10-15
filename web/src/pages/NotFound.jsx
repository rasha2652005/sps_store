import { ArrowRight, Search } from 'lucide-react';
import { useT } from '../lib/prefs.jsx';
import { useUI, useTitle } from '../lib/ui.jsx';
import { Button } from '../components/ui.jsx';
import { Mark } from '../components/brand/Logo.jsx';

export default function NotFound({ text }) {
  const { t } = useT();
  const ui = useUI();
  useTitle(t('notfound.title'));
  return (
    <div className="wrap animate-fade-in py-16">
      <div className="dark panels relative mx-auto flex max-w-3xl flex-col items-center overflow-hidden rounded-[36px] bg-[#0b0b0d] px-6 py-16 text-center text-white">
        <Mark className="absolute -bottom-10 -end-10 h-64 w-auto text-white/[0.04]" />
        <p className="font-display text-[110px] font-bold leading-none tracking-tighter sm:text-[150px]">404</p>
        <h1 className="mt-2 font-display text-2xl font-bold">{t('notfound.title')}</h1>
        <p className="mt-2 max-w-sm text-white/60">{text || t('notfound.text')}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button to="/" variant="light" iconEnd={ArrowRight}>
            {t('notfound.home')}
          </Button>
          <Button variant="glass" icon={Search} onClick={ui.openSearch}>
            {t('nav.search')}
          </Button>
        </div>
      </div>
    </div>
  );
}

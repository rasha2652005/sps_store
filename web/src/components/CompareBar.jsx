import { Link, useLocation } from 'react-router';
import { X } from 'lucide-react';
import { useApi, qs } from '../lib/api.js';
import { useT } from '../lib/prefs.jsx';
import { useLists } from '../lib/account.jsx';
import { Img } from './ui.jsx';

/** Floating bar when products are selected for comparison. */
export function CompareBar() {
  const { t } = useT();
  const lists = useLists();
  const location = useLocation();
  const { data } = useApi(lists.compare.length ? `/api/products${qs({ ids: lists.compare.join(','), limit: 4 })}` : null);
  if (!lists.compare.length || /^\/(compare|checkout|admin)/.test(location.pathname)) return null;
  return (
    <div className="fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 lg:bottom-6">
      <div className="flex items-center gap-3 rounded-full bg-inverse py-2 pe-2 ps-4 text-on-inverse shadow-[var(--shadow-pop)] animate-fade-up">
        <div className="flex -space-x-2 rtl:space-x-reverse">
          {(data?.items || []).map((p) => (
            <Img thumb key={p.id} src={p.images[0]?.url} alt="" className="size-9 rounded-full border-2 border-inverse bg-white p-0.5" />
          ))}
        </div>
        <Link to="/compare" className="rounded-full bg-on-inverse px-4 py-2 text-sm font-bold text-inverse">
          {t('compare.bar', { count: lists.compare.length })}
        </Link>
        <button onClick={lists.clearCompare} className="grid size-8 place-items-center rounded-full opacity-70 hover:opacity-100" aria-label={t('common.clear')}>
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

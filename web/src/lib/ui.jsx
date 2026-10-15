// Global UI state: search overlay, mobile menu and product quick view.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router';

const UICtx = createContext(null);

export function UIProvider({ children }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickView, setQuickView] = useState(null);
  const location = useLocation();

  // Close overlays when navigating.
  useEffect(() => {
    setSearchOpen(false);
    setMenuOpen(false);
    setQuickView(null);
  }, [location.pathname, location.search]);

  // "/" or Ctrl/Cmd+K opens search.
  useEffect(() => {
    const on = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable;
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        if (location.pathname.startsWith('/admin')) return;
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [location.pathname]);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const value = useMemo(
    () => ({ searchOpen, openSearch, closeSearch: () => setSearchOpen(false), menuOpen, setMenuOpen, quickView, openQuickView: setQuickView, closeQuickView: () => setQuickView(null) }),
    [searchOpen, openSearch, menuOpen, quickView],
  );
  return <UICtx.Provider value={value}>{children}</UICtx.Provider>;
}

export const useUI = () => useContext(UICtx);

/** Updates the document title. */
export function useTitle(title) {
  useEffect(() => {
    if (title) document.title = `${title} | Smart Phone Store`;
  }, [title]);
}

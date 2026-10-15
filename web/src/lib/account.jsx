// Customer session + wishlist, compare list and recently viewed products.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, setCache, useApi } from './api.js';
import { readJSON, writeJSON } from './cart.jsx';

const AuthCtx = createContext(null);
const ListsCtx = createContext(null);

export function AuthProvider({ children }) {
  const { data, reload } = useApi('/api/auth/me', { ttl: 10 * 60 * 1000 });
  const set = useCallback((me) => setCache('/api/auth/me', me), []);
  const value = useMemo(
    () => ({
      ready: data !== undefined,
      customer: data?.customer || null,
      addresses: data?.addresses || [],
      serverWishlist: data?.wishlist || [],
      set,
      reload,
      async login(login, password) {
        const me = await api('/api/auth/login', { method: 'POST', body: { login, password } });
        set(me);
        return me;
      },
      async register(body) {
        const me = await api('/api/auth/register', { method: 'POST', body });
        set(me);
        return me;
      },
      async logout() {
        await api('/api/auth/logout', { method: 'POST', body: {} }).catch(() => {});
        set({ customer: null, wishlist: [], addresses: [] });
      },
    }),
    [data, set, reload],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);

const W = 'sps:wish';
const C = 'sps:compare';
const R = 'sps:recent';

export function ListsProvider({ children }) {
  const auth = useAuth();
  const [wish, setWish] = useState(() => readJSON(W, []));
  const [compare, setCompare] = useState(() => readJSON(C, []));
  const [recent, setRecent] = useState(() => readJSON(R, []));
  const merged = useRef(false);

  useEffect(() => writeJSON(W, wish), [wish]);
  useEffect(() => writeJSON(C, compare), [compare]);
  useEffect(() => writeJSON(R, recent), [recent]);

  // When logged in, the account wishlist wins; local items are merged into it once.
  useEffect(() => {
    if (!auth.customer) {
      merged.current = false;
      return;
    }
    if (merged.current) {
      setWish(auth.serverWishlist);
      return;
    }
    merged.current = true;
    const local = readJSON(W, []);
    const missing = local.filter((id) => !auth.serverWishlist.includes(id));
    if (missing.length) {
      api('/api/account/wishlist/merge', { method: 'POST', body: { product_ids: missing } })
        .then((r) => setWish(r.wishlist))
        .catch(() => setWish(auth.serverWishlist));
    } else setWish(auth.serverWishlist);
  }, [auth.customer, auth.serverWishlist]);

  const toggleWish = useCallback(
    (id) => {
      const on = !wish.includes(id);
      setWish((l) => (on ? [id, ...l.filter((x) => x !== id)] : l.filter((x) => x !== id)));
      if (auth.customer) api('/api/account/wishlist', { method: 'POST', body: { product_id: id, on } }).catch(() => {});
      return on;
    },
    [auth.customer, wish],
  );
  const toggleCompare = useCallback(
    (id) => {
      const on = !compare.includes(id);
      setCompare((l) => (on ? [...l.filter((x) => x !== id), id].slice(-4) : l.filter((x) => x !== id)));
      return on;
    },
    [compare],
  );
  const addRecent = useCallback((id) => setRecent((l) => [id, ...l.filter((x) => x !== id)].slice(0, 12)), []);

  const value = useMemo(
    () => ({
      wish,
      inWish: (id) => wish.includes(id),
      toggleWish,
      compare,
      inCompare: (id) => compare.includes(id),
      toggleCompare,
      clearCompare: () => setCompare([]),
      recent,
      addRecent,
    }),
    [wish, toggleWish, compare, toggleCompare, recent, addRecent],
  );
  return <ListsCtx.Provider value={value}>{children}</ListsCtx.Provider>;
}
export const useLists = () => useContext(ListsCtx);

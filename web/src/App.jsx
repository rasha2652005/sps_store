import { Suspense, lazy, useEffect } from 'react';
import { Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router';
import { StoreProvider } from './lib/store.jsx';
import { AuthProvider, ListsProvider } from './lib/account.jsx';
import { CartProvider } from './lib/cart.jsx';
import { UIProvider } from './lib/ui.jsx';
import { useT } from './lib/prefs.jsx';
import { AnnouncementBar, Header, WhatsAppFab } from './components/layout/Header.jsx';
import { MobileMenu, MobileNav } from './components/layout/Nav.jsx';
import { Footer } from './components/layout/Footer.jsx';
import { SearchOverlay } from './components/SearchOverlay.jsx';
import { CartDrawer } from './components/CartDrawer.jsx';
import { QuickView } from './components/product/QuickView.jsx';
import { Button, Skeleton } from './components/ui.jsx';
import { Mark } from './components/brand/Logo.jsx';
import Home from './pages/Home.jsx';
import Shop from './pages/Shop.jsx';
import Product from './pages/Product.jsx';
import NotFound from './pages/NotFound.jsx';
import { CompareBar } from './components/CompareBar.jsx';

const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const Order = lazy(() => import('./pages/Order.jsx'));
const Track = lazy(() => import('./pages/Order.jsx').then((m) => ({ default: m.Track })));
const Account = lazy(() => import('./pages/Account.jsx'));
const Wishlist = lazy(() => import('./pages/Lists.jsx').then((m) => ({ default: m.Wishlist })));
const Compare = lazy(() => import('./pages/Lists.jsx').then((m) => ({ default: m.Compare })));
const CartPage = lazy(() => import('./pages/Lists.jsx').then((m) => ({ default: m.CartPage })));
const TradeIn = lazy(() => import('./pages/Info.jsx').then((m) => ({ default: m.TradeIn })));
const Contact = lazy(() => import('./pages/Info.jsx').then((m) => ({ default: m.Contact })));
const Policies = lazy(() => import('./pages/Info.jsx').then((m) => ({ default: m.Policies })));
const Finder = lazy(() => import('./pages/Info.jsx').then((m) => ({ default: m.Finder })));
export const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

function ScrollToTop() {
  const { pathname } = useLocation();
  const nav = useNavigationType();
  useEffect(() => {
    if (nav !== 'POP') window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, nav]);
  return null;
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg">
      <Mark className="h-10 w-auto animate-pulse text-ink" />
    </div>
  );
}

function Offline({ retry }) {
  const { t } = useT();
  return (
    <div className="grid min-h-dvh place-items-center bg-bg p-6 text-center">
      <div>
        <Mark className="mx-auto h-10 w-auto text-ink" />
        <h1 className="mt-6 font-display text-2xl font-bold">{t('common.error_title')}</h1>
        <p className="mx-auto mt-2 max-w-sm text-muted">{t('common.offline')}</p>
        <Button className="mt-6" onClick={retry}>
          {t('common.retry')}
        </Button>
      </div>
    </div>
  );
}

const PageFallback = () => (
  <div className="wrap space-y-4 pt-10">
    <Skeleton className="h-10 w-1/3" />
    <Skeleton className="h-72" />
  </div>
);

export function StoreApp() {
  return (
    <StoreProvider fallback={<Splash />} errorView={(retry) => <Offline retry={retry} />}>
      <AuthProvider>
        <ListsProvider>
          <CartProvider>
            <UIProvider>
              <ScrollToTop />
              <div className="flex min-h-dvh flex-col pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-0">
                <AnnouncementBar />
                <Header />
                <main className="flex-1">
                  <Suspense fallback={<PageFallback />}>
                    <Routes>
                      <Route index element={<Home />} />
                      <Route path="shop" element={<Shop />} />
                      <Route path="search" element={<Shop />} />
                      <Route path="deals" element={<Shop />} />
                      <Route path="used" element={<Shop />} />
                      <Route path="c/:slug" element={<Shop />} />
                      <Route path="b/:slug" element={<Shop />} />
                      <Route path="finder" element={<Finder />} />
                      <Route path="finder/:device" element={<Shop />} />
                      <Route path="product/:slug" element={<Product />} />
                      <Route path="cart" element={<CartPage />} />
                      <Route path="checkout" element={<Checkout />} />
                      <Route path="order/:number" element={<Order />} />
                      <Route path="track" element={<Track />} />
                      <Route path="account" element={<Account />} />
                      <Route path="wishlist" element={<Wishlist />} />
                      <Route path="compare" element={<Compare />} />
                      <Route path="trade-in" element={<TradeIn />} />
                      <Route path="contact" element={<Contact />} />
                      <Route path="policies" element={<Policies />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </main>
                <Footer />
              </div>
              <MobileNav />
              <MobileMenu />
              <CartDrawer />
              <SearchOverlay />
              <QuickView />
              <CompareBar />
              <WhatsAppFab />
            </UIProvider>
          </CartProvider>
        </ListsProvider>
      </AuthProvider>
    </StoreProvider>
  );
}

/** Demo only: lets the demo bar (outside React) change pages through the router. */
function DemoBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    window.__SPS_NAVIGATE__ = navigate;
  }, [navigate]);
  return null;
}

export default function App() {
  return (
    <>
    {__DEMO__ && <DemoBridge />}
    <Routes>
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<Splash />}>
            <AdminApp />
          </Suspense>
        }
      />
      <Route path="/*" element={<StoreApp />} />
    </Routes>
    </>
  );
}

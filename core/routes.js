// Every API endpoint of the store, used by both the Node server and the browser demo.
// auth: 'customer' (logged-in shopper), 'admin' (any team member), 'owner' (store owner only).
import * as store from './api/store.js';
import * as account from './api/account.js';
import * as adminAuth from './api/admin/auth.js';
import * as dash from './api/admin/dashboard.js';
import * as aOrders from './api/admin/orders.js';
import * as aProducts from './api/admin/products.js';
import * as aCatalog from './api/admin/catalog.js';
import * as people from './api/admin/people.js';
import * as aSettings from './api/admin/settings.js';

const r = (method, path, handler, auth = null) => ({ method, path, handler, auth });

export const routes = [
  // storefront
  r('GET', '/api/bootstrap', store.bootstrap),
  r('GET', '/api/home', store.home),
  r('GET', '/api/products', store.products),
  r('GET', '/api/products/:slug', store.product),
  r('GET', '/api/products/:slug/reviews', store.reviews),
  r('POST', '/api/products/:slug/reviews', store.addReview, 'customer'),
  r('GET', '/api/search/suggest', store.suggest),
  r('POST', '/api/cart/quote', store.cartQuote),
  r('POST', '/api/orders', store.createOrder),
  r('POST', '/api/orders/track', store.trackOrder),
  r('GET', '/api/orders/:number', store.getOrder),
  r('POST', '/api/orders/:number/cancel', store.cancelOrder),
  r('POST', '/api/stock-alerts', store.stockAlert),
  r('POST', '/api/tradeins', store.tradeIn),

  // customer account
  r('POST', '/api/auth/register', account.register),
  r('POST', '/api/auth/login', account.login),
  r('POST', '/api/auth/logout', account.logout),
  r('GET', '/api/auth/me', account.me),
  r('PUT', '/api/account/profile', account.updateProfile, 'customer'),
  r('PUT', '/api/account/password', account.changePassword, 'customer'),
  r('GET', '/api/account/orders', account.myOrders, 'customer'),
  r('POST', '/api/account/addresses', account.addAddress, 'customer'),
  r('PUT', '/api/account/addresses/:id', account.updateAddress, 'customer'),
  r('DELETE', '/api/account/addresses/:id', account.deleteAddress, 'customer'),
  r('POST', '/api/account/wishlist', account.wishlistToggle, 'customer'),
  r('POST', '/api/account/wishlist/merge', account.wishlistMerge, 'customer'),

  // admin: access
  r('GET', '/api/admin/setup', adminAuth.setupStatus),
  r('POST', '/api/admin/setup', adminAuth.setup),
  r('POST', '/api/admin/login', adminAuth.login),
  r('POST', '/api/admin/logout', adminAuth.logout),
  r('GET', '/api/admin/me', adminAuth.me),
  r('PUT', '/api/admin/me/password', adminAuth.changePassword, 'admin'),
  r('GET', '/api/admin/team', adminAuth.team, 'owner'),
  r('POST', '/api/admin/team', adminAuth.addMember, 'owner'),
  r('DELETE', '/api/admin/team/:id', adminAuth.removeMember, 'owner'),

  // admin: overview
  r('GET', '/api/admin/dashboard', dash.dashboard, 'admin'),
  r('GET', '/api/admin/pulse', dash.pulse, 'admin'),

  // admin: orders
  r('GET', '/api/admin/orders', aOrders.list, 'admin'),
  r('GET', '/api/admin/orders-export', aOrders.exportCsv, 'admin'),
  r('GET', '/api/admin/orders/:id', aOrders.get, 'admin'),
  r('PATCH', '/api/admin/orders/:id', aOrders.patch, 'admin'),

  // admin: products
  r('GET', '/api/admin/products', aProducts.list, 'admin'),
  r('POST', '/api/admin/products', aProducts.create, 'admin'),
  r('GET', '/api/admin/products/:id', aProducts.get, 'admin'),
  r('PUT', '/api/admin/products/:id', aProducts.update, 'admin'),
  r('PATCH', '/api/admin/products/:id', aProducts.patch, 'admin'),
  r('DELETE', '/api/admin/products/:id', aProducts.remove, 'admin'),
  r('POST', '/api/admin/products/:id/duplicate', aProducts.duplicate, 'admin'),
  r('PATCH', '/api/admin/variants/:id', aProducts.patchVariant, 'admin'),
  r('POST', '/api/admin/uploads', aProducts.upload, 'admin'),

  // admin: categories & brands
  r('GET', '/api/admin/taxonomy', aCatalog.taxonomy, 'admin'),
  r('POST', '/api/admin/categories', aCatalog.createCategory, 'admin'),
  r('PUT', '/api/admin/categories/:id', aCatalog.updateCategory, 'admin'),
  r('DELETE', '/api/admin/categories/:id', aCatalog.deleteCategory, 'admin'),
  r('POST', '/api/admin/brands', aCatalog.createBrand, 'admin'),
  r('PUT', '/api/admin/brands/:id', aCatalog.updateBrand, 'admin'),
  r('DELETE', '/api/admin/brands/:id', aCatalog.deleteBrand, 'admin'),

  // admin: people & requests
  r('GET', '/api/admin/customers', people.customers, 'admin'),
  r('GET', '/api/admin/customers/:id', people.customer, 'admin'),
  r('PATCH', '/api/admin/customers/:id', people.patchCustomer, 'admin'),
  r('POST', '/api/admin/customers/:id/reset-password', people.resetCustomerPassword, 'admin'),
  r('GET', '/api/admin/reviews', people.reviews, 'admin'),
  r('PATCH', '/api/admin/reviews/:id', people.patchReview, 'admin'),
  r('DELETE', '/api/admin/reviews/:id', people.deleteReview, 'admin'),
  r('GET', '/api/admin/stock-alerts', people.stockAlerts, 'admin'),
  r('PATCH', '/api/admin/stock-alerts/:id', people.patchStockAlert, 'admin'),
  r('DELETE', '/api/admin/stock-alerts/:id', people.deleteStockAlert, 'admin'),
  r('GET', '/api/admin/tradeins', people.tradeins, 'admin'),
  r('PATCH', '/api/admin/tradeins/:id', people.patchTradein, 'admin'),
  r('DELETE', '/api/admin/tradeins/:id', people.deleteTradein, 'admin'),

  // admin: settings, coupons, demo data
  r('GET', '/api/admin/settings', aSettings.getAll, 'admin'),
  r('PUT', '/api/admin/settings/:section', aSettings.put, 'owner'),
  r('GET', '/api/admin/coupons', aSettings.coupons, 'admin'),
  r('POST', '/api/admin/coupons', aSettings.createCoupon, 'admin'),
  r('PUT', '/api/admin/coupons/:id', aSettings.updateCoupon, 'admin'),
  r('DELETE', '/api/admin/coupons/:id', aSettings.deleteCoupon, 'admin'),
  r('GET', '/api/admin/demo', aSettings.demoInfo, 'admin'),
  r('POST', '/api/admin/demo/clear', aSettings.clearDemo, 'owner'),
];

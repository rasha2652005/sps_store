// Applies the saved language and theme before the page paints (prevents a flash of the wrong theme/direction).
(function () {
  var p = {};
  try {
    p = JSON.parse(localStorage.getItem('sps:prefs') || '{}') || {};
  } catch (e) {}
  var d = document.documentElement;
  var lang = p.lang === 'ar' || p.lang === 'en' ? p.lang : (navigator.language || '').toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en';
  d.lang = lang;
  d.dir = lang === 'ar' ? 'rtl' : 'ltr';
  var dark = p.theme === 'dark' || (p.theme !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) d.classList.add('dark');
})();

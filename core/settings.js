import { parseJson, isoNow } from './util.js';

// Everything the shop owner can change from Admin → Settings. Stored per section in the `settings` table.
export const DEFAULT_SETTINGS = {
  store: {
    name_en: 'Smart Phone Store',
    name_ar: 'سمارت فون ستور',
    short_name: 'SPS',
    tagline_en: 'Phones & accessories, delivered all over Lebanon',
    tagline_ar: 'هواتف وإكسسوارات، توصيل لكل لبنان',
    phone: '+961 81 078 452',
    whatsapp: '+96181078452',
    email: '',
    address_en: 'Lebanon',
    address_ar: 'لبنان',
    maps_url: '',
    hours_en: 'Mon – Sat, 10:00 – 20:00',
    hours_ar: 'الإثنين – السبت، 10:00 – 20:00',
    instagram: 'https://www.instagram.com/sps_mob',
    facebook: '',
    tiktok: '',
  },
  delivery: {
    free_over: 100,
    eta_en: '1–3 working days',
    eta_ar: '1–3 أيام عمل',
    pickup_enabled: true,
    zones: [
      { id: 'beirut', en: 'Beirut', ar: 'بيروت', fee: 3 },
      { id: 'mount-lebanon', en: 'Mount Lebanon', ar: 'جبل لبنان', fee: 4 },
      { id: 'keserwan-jbeil', en: 'Keserwan – Jbeil', ar: 'كسروان – جبيل', fee: 4 },
      { id: 'north', en: 'North', ar: 'الشمال', fee: 5 },
      { id: 'akkar', en: 'Akkar', ar: 'عكار', fee: 6 },
      { id: 'bekaa', en: 'Bekaa', ar: 'البقاع', fee: 5 },
      { id: 'baalbek-hermel', en: 'Baalbek – Hermel', ar: 'بعلبك – الهرمل', fee: 6 },
      { id: 'south', en: 'South', ar: 'الجنوب', fee: 5 },
      { id: 'nabatieh', en: 'Nabatieh', ar: 'النبطية', fee: 5 },
    ],
  },
  payments: {
    cod: { enabled: true },
    whish: { enabled: true, account_name: 'Smart Phone Store', account_number: '81 078 452' },
    omt: { enabled: true, account_name: 'Smart Phone Store', account_number: '81 078 452' },
    store: { enabled: true },
  },
  currency: {
    lbp_rate: 89500,
    show_lbp: true,
  },
  home: {
    announcement_en: 'Free delivery on orders over $100 — all over Lebanon',
    announcement_ar: 'توصيل مجاني للطلبات فوق 100$ — لكل لبنان',
    trending: ['iPhone 17 Pro', 'Galaxy S25 Ultra', 'AirPods', 'شاحن سريع', 'كفر'],
    // The 4 promises shown under the hero. Edit them to match what the shop really offers.
    trust: [
      { icon: 'truck', title_en: 'Delivery all over Lebanon', title_ar: 'توصيل لكل لبنان', text_en: 'From Beirut to Akkar, at your door', text_ar: 'من بيروت لعكار، لعند باب البيت' },
      { icon: 'cash', title_en: 'Cash on delivery', title_ar: 'الدفع عند الاستلام', text_en: 'Or pay with Whish & OMT', text_ar: 'أو ادفع عبر Whish و OMT' },
      { icon: 'shield', title_en: 'Original devices', title_ar: 'أجهزة أصلية', text_en: 'With warranty and invoice', text_ar: 'مع كفالة وفاتورة' },
      { icon: 'swap', title_en: '7-day exchange', title_ar: 'تبديل خلال 7 أيام', text_en: 'Changed your mind? We exchange', text_ar: 'غيّرت رأيك؟ منبدّلك' },
    ],
    hero: [
      {
        eyebrow_en: 'Just landed',
        eyebrow_ar: 'وصل حديثاً',
        title_en: 'iPhone 17 Pro.',
        title_ar: 'آيفون 17 برو.',
        subtitle_en: 'A19 Pro chip, a 48MP Pro camera system and the new Cosmic Orange finish.',
        subtitle_ar: 'معالج A19 Pro، كاميرات برو 48 ميغابكسل، ولون Cosmic Orange الجديد.',
        cta_en: 'Shop iPhone 17 Pro',
        cta_ar: 'تسوّق آيفون 17 برو',
        link: '/product/iphone-17-pro',
        product_slug: 'iphone-17-pro',
        color: 'Cosmic Orange',
      },
      {
        eyebrow_en: 'Deal of the week',
        eyebrow_ar: 'عرض الأسبوع',
        title_en: 'Galaxy S25 Ultra, for less.',
        title_ar: 'غالاكسي S25 ألترا بسعر أقل.',
        subtitle_en: '200MP camera, built-in S Pen and a titanium frame, now with a special price.',
        subtitle_ar: 'كاميرا 200 ميغابكسل، قلم S Pen مدمج وإطار تيتانيوم، الآن بسعر خاص.',
        cta_en: 'See the deal',
        cta_ar: 'شوف العرض',
        link: '/product/galaxy-s25-ultra',
        product_slug: 'galaxy-s25-ultra',
        color: 'Titanium Silverblue',
      },
      {
        eyebrow_en: 'Power up',
        eyebrow_ar: 'شحن أسرع',
        title_en: 'Fast charging, done right.',
        title_ar: 'شحن سريع، متل ما لازم.',
        subtitle_en: 'GaN chargers, braided cables and magnetic power banks for every phone.',
        subtitle_ar: 'شواحن GaN، كابلات مجدولة وباور بنك مغناطيسي لكل الهواتف.',
        cta_en: 'Shop charging',
        cta_ar: 'تسوّق الشواحن',
        link: '/c/chargers',
        product_slug: 'gan-65w-3-port-charger',
        color: '',
      },
    ],
  },
  policies: {
    warranty_en:
      'New phones come with the official warranty mentioned on each product. Used and refurbished devices carry a shop warranty from the day of purchase. Keep your invoice: it is your warranty card.',
    warranty_ar:
      'الهواتف الجديدة تأتي مع الكفالة الرسمية المذكورة على كل منتج. الأجهزة المستعملة والمجدّدة عليها كفالة من المحل من يوم الشراء. احتفظ بالفاتورة، فهي بطاقة الكفالة.',
    returns_en:
      'You can exchange an item within 7 days if it is unused, in its original box and with all accessories. Opened phones can only be exchanged for a manufacturing defect.',
    returns_ar:
      'بتقدر تبدّل أي منتج خلال 7 أيام إذا ما كان مستعمل، بعلبته الأصلية ومع كل الإكسسوارات. الهواتف المفتوحة بتتبدّل بس إذا في عيب مصنعي.',
    delivery_en:
      'We deliver all over Lebanon. You pay the delivery fee of your area, or nothing at all on orders above the free-delivery amount. Our team calls you to confirm before delivering.',
    delivery_ar:
      'منوصّل لكل لبنان. بتدفع رسم التوصيل حسب منطقتك، أو ولا شي إذا طلبك فوق حدّ التوصيل المجاني. فريقنا بيتصل فيك ليأكد قبل التوصيل.',
  },
  tradein: {
    enabled: true,
  },
};

const SECTIONS = Object.keys(DEFAULT_SETTINGS);
export const SETTINGS_SECTIONS = SECTIONS;

export function getSettings(db) {
  const out = structuredClone(DEFAULT_SETTINGS);
  for (const row of db.all('SELECT key, value FROM settings')) {
    if (!SECTIONS.includes(row.key)) continue;
    const saved = parseJson(row.value, {});
    out[row.key] = { ...out[row.key], ...saved };
  }
  return out;
}

export function saveSettingsSection(db, key, value) {
  if (!SECTIONS.includes(key)) throw new Error('Unknown settings section');
  db.run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    JSON.stringify(value),
  );
  db.run(
    "INSERT INTO meta (key, value) VALUES ('settings_updated_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    isoNow(),
  );
}

export const PAYMENT_METHODS = ['cod', 'whish', 'omt', 'store'];

/** Which payment methods a customer can pick for a delivery method. */
export function paymentMethodsFor(settings, deliveryMethod) {
  const p = settings.payments || {};
  const list = [];
  if (deliveryMethod === 'pickup') {
    if (p.store?.enabled) list.push('store');
  } else if (p.cod?.enabled) list.push('cod');
  if (p.whish?.enabled) list.push('whish');
  if (p.omt?.enabled) list.push('omt');
  return list;
}

/** What the storefront is allowed to see. */
export function publicSettings(s) {
  const pay = (k) => (s.payments[k]?.enabled ? { enabled: true, account_name: s.payments[k].account_name || '', account_number: s.payments[k].account_number || '' } : { enabled: false });
  return {
    store: s.store,
    delivery: s.delivery,
    payments: { cod: pay('cod'), whish: pay('whish'), omt: pay('omt'), store: pay('store') },
    currency: s.currency,
    home: {
      announcement_en: s.home.announcement_en,
      announcement_ar: s.home.announcement_ar,
      trending: s.home.trending || [],
      trust: s.home.trust || [],
    },
    policies: s.policies,
    tradein: s.tradein,
  };
}

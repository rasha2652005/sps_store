// Links that must work both on the real website and in the single-file demo (which uses hash routing).
export const storeHref = (path) => (__DEMO__ ? `#${path}` : path);
export const absoluteUrl = (path) => (__DEMO__ ? `${window.location.href.split('#')[0]}#${path}` : `${window.location.origin}${path}`);
/** Image URLs: the demo keeps uploaded photos in the browser and maps their paths to local blob URLs. */
export const assetUrl = (url) => (__DEMO__ && url && window.__SPS_ASSET__ ? window.__SPS_ASSET__(url) : url);
/** Small version of an uploaded photo (saved next to it as name.t.ext); other images are returned as they are. */
export const thumbUrl = (url) =>
  typeof url === 'string' && /^\/uploads\/(?!seed\/).+\.(webp|jpe?g|png|gif|avif)$/i.test(url) && !/\.t\.\w+$/i.test(url) ? url.replace(/\.(\w+)$/, '.t.$1') : url;

// URL constants for the admin SPA.
//
// These used to be hardcoded in two places (`App.jsx` and `api/client.js`),
// which is exactly how the doubled `/zxcv/zxcv` console path and the
// post-expiry redirect-to-landing bug got in: the literal meant "the browser
// mount point" in one file and "the in-app route" in the other.
//
// Keep the two concepts separate:
//   ADMIN_BASE  — where this app is MOUNTED in the browser (the Vite base,
//                 /zxcv). Deriving it from import.meta.env means it can never
//                 drift from the build.
//   ADMIN_PATH  — the in-app route for the console.

/** Browser mount prefix. Derives from Vite `base`, so BASE_PATH stays the one source of truth. */
export const ADMIN_BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

/**
 * In-app route for the admin console: "/" — the console IS the app's root.
 *
 * With basename "/zxcv" this resolves in the browser to /zxcv/, so
 * http://localhost/zxcv/ opens the dashboard (or the login screen when there
 * is no admin session). The landing page previously owned "/" and the console
 * lived at "/dashboard", which meant /zxcv/ showed a marketing hero instead of
 * the control panel. The landing page is now at ADMIN_WELCOME_PATH.
 */
export const ADMIN_PATH = "/";

/** Absolute browser URL of the console: mount prefix + route. */
export const ADMIN_CONSOLE_URL = `${ADMIN_BASE}${ADMIN_PATH}`;

/** In-app route of the (optional) landing page. */
export const ADMIN_WELCOME_PATH = "/welcome";
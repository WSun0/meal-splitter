const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
  },
  fallbacks: {
    document: '/offline',
  },
});

const isDev = process.env.NODE_ENV === 'development';

/*
 * Content Security Policy.
 * - Scripts only from this origin. 'unsafe-inline' is required for Next's
 *   inline bootstrap scripts without per-request nonces (nonces would force
 *   every page to render dynamically); it still blocks scripts from any other
 *   origin, plugins, framing and form posts elsewhere.
 * - Google Fonts is the only third party (stylesheet + font files; the
 *   service worker also fetches them for offline caching).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  `connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com${isDev ? ' ws:' : ''}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Fonts read from disk by the link-preview image routes.
  outputFileTracingIncludes: {
    '/opengraph-image': ['./lib/og/fonts/**'],
    '/s/[id]/opengraph-image': ['./lib/og/fonts/**'],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Shared splits contain names and amounts: keep them out of search engines.
      { source: '/s/:id', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/split', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
};

module.exports = withPWA(nextConfig);

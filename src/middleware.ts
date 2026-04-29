import { defineMiddleware } from 'astro:middleware';
import { loadSession, readSessionCookie } from './lib/auth';
import { localeFromUrl } from './i18n/use-translation';
import { checkRateLimit, rateLimitKey, tooManyRequests } from './lib/rate-limit';
import { env } from './lib/env';

// ---------------------------------------------------------------------------
// Per-route rate-limit table: [exact-path-or-prefix, limit, windowMs]
// First match wins. Auth endpoints are always IP-keyed (no session yet).
// ---------------------------------------------------------------------------
const RATE_LIMITS: Array<[string, number, number, 'ip' | 'auto']> = [
  ['/api/auth/login',                  5,   60_000,  'ip'],
  ['/api/admin/auth/login',            5,   60_000,  'ip'],
  ['/api/auth/register',               3,   60_000,  'ip'],
  ['/api/auth/request-password-reset', 3,   60_000,  'ip'],
  ['/api/bookings',                    10,  60_000,  'auto'],
  ['/api/admin/run-suggest',           1,  600_000,  'ip'],
];

// ---------------------------------------------------------------------------
// Content-Security-Policy
// 'unsafe-inline' for scripts is required by Astro's client-side hydration
// (inline <script> tags injected at build time). Astro 6 has no first-class
// nonce integration; this is the accepted trade-off until it does.
// ---------------------------------------------------------------------------
const CSP =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; " +
  "font-src 'self' https://fonts.gstatic.com; " +
  "img-src 'self' data: https:; " +
  "connect-src 'self'; " +
  "frame-ancestors 'none'";

export const onRequest = defineMiddleware(async (context, next) => {
  const token = readSessionCookie(context.request.headers);
  const session = await loadSession(token);

  context.locals.user = session?.user ?? null;
  context.locals.sessionId = session?.sessionId ?? null;
  context.locals.locale = localeFromUrl(context.url);

  const path = context.url.pathname;

  // --- Rate limiting (runs before auth gate so brute-force attempts are throttled) ---
  for (const [prefix, limit, windowMs, keyMode] of RATE_LIMITS) {
    if (path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?')) {
      // 'ip' mode: always key by IP, ignoring any authenticated session
      const keyCtx = keyMode === 'ip'
        ? { ...context, locals: { ...context.locals, user: null } }
        : context;
      const key = `${prefix}:${rateLimitKey(keyCtx)}`;
      if (!checkRateLimit(key, limit, windowMs)) {
        return tooManyRequests();
      }
      break;
    }
  }

  // --- Admin auth gate ---
  // /admin/login is the gate itself — let it through unauthenticated
  const isAdminAreaGate = path === '/admin/login' || path === '/api/admin/auth/login';
  if ((path.startsWith('/admin') || path.startsWith('/api/admin')) && !isAdminAreaGate) {
    if (!session) {
      // API endpoints get JSON 401; pages get redirected to the admin login
      if (path.startsWith('/api/admin')) {
        return new Response(JSON.stringify({ ok: false, error: 'unauthenticated' }), {
          status: 401,
          headers: { 'content-type': 'application/json' }
        });
      }
      const params = new URLSearchParams({ next: path });
      return context.redirect(`/admin/login?${params.toString()}`);
    }
    if (session.user.role !== 'admin') {
      // Logged in but not admin — kick them to their guest account
      if (path.startsWith('/api/admin')) {
        return new Response(JSON.stringify({ ok: false, error: 'forbidden' }), {
          status: 403,
          headers: { 'content-type': 'application/json' }
        });
      }
      return context.redirect('/conta');
    }
  }

  const response = await next();

  // --- Security headers (applied to every response) ---
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Content-Security-Policy', CSP);

  // HSTS only when the connection is (or is configured as) HTTPS
  const isHttps =
    context.request.url.startsWith('https:') ||
    env.PUBLIC_SITE_URL.startsWith('https:') ||
    env.NODE_ENV === 'production';
  if (isHttps) {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }

  return response;
});

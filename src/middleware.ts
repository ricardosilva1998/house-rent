import { defineMiddleware } from 'astro:middleware';
import { loadSession, readSessionCookie } from './lib/auth';
import { localeFromUrl } from './i18n/use-translation';

export const onRequest = defineMiddleware(async (context, next) => {
  const token = readSessionCookie(context.request.headers);
  const session = await loadSession(token);

  context.locals.user = session?.user ?? null;
  context.locals.sessionId = session?.sessionId ?? null;
  context.locals.locale = localeFromUrl(context.url);

  const path = context.url.pathname;
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

  return next();
});

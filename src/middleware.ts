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
  if (path.startsWith('/admin') || path.startsWith('/api/admin')) {
    if (!session) {
      const loginUrl = new URL('/conta/login', context.url);
      loginUrl.searchParams.set('next', path);
      return context.redirect(loginUrl.toString());
    }
    if (session.user.role !== 'admin') {
      return new Response('Forbidden', { status: 403 });
    }
  }

  return next();
});

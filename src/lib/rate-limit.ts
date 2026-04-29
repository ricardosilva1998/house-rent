import type { APIContext } from 'astro';

interface Window {
  timestamps: number[];
  /** Approximate memory trim: we only keep entries within the window. */
}

// Global store keyed by "<bucket>:<identifier>".
// A single Map per process is sufficient for SSR on Railway (single container).
const store = new Map<string, Window>();

/**
 * Sliding-window rate limiter — no external dependencies.
 *
 * @param key     Opaque bucket string, e.g. "login:ip:192.168.1.1"
 * @param limit   Max requests allowed in the window
 * @param windowMs Window size in milliseconds
 * @returns true if the request is allowed, false if the limit is exceeded
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;

  let win = store.get(key);
  if (!win) {
    win = { timestamps: [] };
    store.set(key, win);
  }

  // Evict timestamps outside the window
  win.timestamps = win.timestamps.filter((t) => t > cutoff);

  if (win.timestamps.length >= limit) {
    return false;
  }

  win.timestamps.push(now);
  return true;
}

/**
 * Extract a stable key for rate-limiting from an Astro APIContext.
 * For authenticated requests uses userId; falls back to clientAddress or a
 * forwarded-for header.  Always returns a non-empty string.
 */
export function rateLimitKey(context: Pick<APIContext, 'clientAddress' | 'locals' | 'request'>): string {
  const user = (context.locals as any)?.user;
  if (user?.id) return `uid:${user.id}`;

  // Try X-Forwarded-For first (Railway / reverse proxy sets it)
  const xff = context.request.headers.get('x-forwarded-for');
  const ip = xff ? xff.split(',')[0]!.trim() : (context.clientAddress ?? 'unknown');
  return `ip:${ip}`;
}

/** Build a 429 Too Many Requests JSON response. */
export function tooManyRequests(): Response {
  return Response.json(
    { ok: false, error: 'too_many_requests' },
    {
      status: 429,
      headers: { 'Retry-After': '60' }
    }
  );
}

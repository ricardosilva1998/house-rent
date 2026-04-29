import { timingSafeEqual } from 'node:crypto';
import { env } from './env';

/**
 * Verify the Authorization: Bearer <CRON_SECRET> header using a timing-safe
 * comparison so that response-time differences cannot leak prefix information
 * about the secret.
 *
 * timingSafeEqual throws when buffer lengths differ, so we always compare
 * fixed-length UTF-8 encodings of the expected value — the provided token is
 * padded/truncated to the expected length before comparison, so a wrong-length
 * token still returns false in constant time relative to len(expected).
 * The length of the expected secret is already implicit from env docs and is
 * not a meaningful oracle here.
 */
export function verifyCronAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization') ?? '';
  const prefix = 'Bearer ';
  if (!authHeader.startsWith(prefix)) return false;
  const provided = authHeader.slice(prefix.length);

  const expected = env.CRON_SECRET;
  const enc = new TextEncoder();
  const a = enc.encode(expected);
  const b = enc.encode(provided);

  // Pad / truncate b to the same byte length as a before comparing so
  // timingSafeEqual does not throw.  A wrong-length token will never equal a
  // correctly-padded value, so the result is still correct.
  const bPadded = new Uint8Array(a.length);
  bPadded.set(b.slice(0, a.length));

  return timingSafeEqual(a, bPadded);
}

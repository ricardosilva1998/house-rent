import { eq, and, gt } from 'drizzle-orm';
import { hash, verify } from '@node-rs/argon2';
import { encodeBase32LowerCaseNoPadding } from '@oslojs/encoding';
import { createHmac } from 'node:crypto';
import { db } from '../db/client';
import { users, sessions, userTokens } from '../db/schema';
import type { User } from '../db/schema';
import { env } from './env';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24 h
const SESSION_COOKIE = 'rdb_session';

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, {
    memoryCost: 19 * 1024,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1
  });
}

export async function verifyPassword(plain: string, h: string): Promise<boolean> {
  try {
    return await verify(h, plain);
  } catch {
    return false;
  }
}

function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function generateToken(): string {
  return encodeBase32LowerCaseNoPadding(randomBytes(20));
}

export function hashToken(token: string): string {
  // HMAC-SHA256 keyed with SESSION_SECRET so that tokens cannot be brute-forced
  // from the hash column alone — rotating the secret also invalidates all sessions.
  return createHmac('sha256', env.SESSION_SECRET).update(token).digest('hex');
}

export async function createSession(userId: string, ip?: string, userAgent?: string) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    userId,
    tokenHash,
    expiresAt,
    ip: ip ?? null,
    userAgent: userAgent ?? null
  });
  return { token, expiresAt };
}

export async function loadSession(token: string | undefined): Promise<{ user: User; sessionId: string } | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  return row ? { user: row.user, sessionId: row.session.id } : null;
}

export async function destroySession(token: string | undefined) {
  if (!token) return;
  const tokenHash = hashToken(token);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

export async function destroyAllUserSessions(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function createUserToken(
  userId: string,
  type: 'verify_email' | 'reset_password' | 'admin_invite',
  ttlMs = TOKEN_TTL_MS
) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ttlMs);
  await db.insert(userTokens).values({ userId, type, tokenHash, expiresAt });
  return { token, expiresAt };
}

export async function consumeUserToken(
  token: string,
  type: 'verify_email' | 'reset_password' | 'admin_invite'
): Promise<string | null> {
  const tokenHash = hashToken(token);
  const rows = await db
    .select()
    .from(userTokens)
    .where(and(eq(userTokens.tokenHash, tokenHash), eq(userTokens.type, type)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.usedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  await db.update(userTokens).set({ usedAt: new Date() }).where(eq(userTokens.id, row.id));
  return row.userId;
}

export function setSessionCookie(headers: Headers, token: string, expiresAt: Date) {
  const isSecure =
    process.env.NODE_ENV === 'production' || env.PUBLIC_SITE_URL.startsWith('https:');
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${expiresAt.toUTCString()}`
  ];
  if (isSecure) parts.push('Secure');
  headers.append('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(headers: Headers) {
  const isSecure =
    process.env.NODE_ENV === 'production' || env.PUBLIC_SITE_URL.startsWith('https:');
  const parts = [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  ];
  if (isSecure) parts.push('Secure');
  headers.append('Set-Cookie', parts.join('; '));
}

export function readSessionCookie(headers: Headers): string | undefined {
  const cookieHeader = headers.get('cookie') ?? '';
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return rest.join('=');
  }
  return undefined;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return rows[0] ?? null;
}

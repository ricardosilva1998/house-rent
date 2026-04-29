import type { APIRoute } from 'astro';
import { z } from 'zod';
import { eq, like, or, count, desc, sql } from 'drizzle-orm';
import { db } from '../../../db/client';
import { users, bookings } from '../../../db/schema';

const RoleParam = z.enum(['guest', 'admin']).optional();

function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&');
}

export const GET: APIRoute = async ({ url }) => {
  const roleRaw = url.searchParams.get('role') ?? undefined;
  const roleParsed = RoleParam.safeParse(roleRaw);
  const role = roleParsed.success ? roleParsed.data : undefined;
  const search = url.searchParams.get('search');

  const where = [] as any[];
  if (role) where.push(eq(users.role, role));
  if (search) {
    const safeSearch = escapeLike(search);
    where.push(
      or(like(users.email, `%${escapeLike(search.toLowerCase())}%`), like(users.name, `%${safeSearch}%`))
    );
  }

  const list = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      country: users.country,
      role: users.role,
      emailVerifiedAt: users.emailVerifiedAt,
      createdAt: users.createdAt
    })
    .from(users)
    .where(where.length ? (where.length === 1 ? where[0] : where.reduce((a, b) => sql`${a} AND ${b}`)) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(200);

  // Aggregate booking counts per user in one pass
  const bookingCounts = await db
    .select({ userId: bookings.userId, total: count() })
    .from(bookings)
    .groupBy(bookings.userId);
  const countMap = new Map(bookingCounts.map((b) => [b.userId, b.total]));

  return Response.json({
    ok: true,
    users: list.map((u) => ({
      ...u,
      bookings: countMap.get(u.id) ?? 0
    }))
  });
};

const PatchBody = z.object({
  role: z.enum(['guest', 'admin']).optional()
});

export const PATCH: APIRoute = async ({ request, url, locals }) => {
  const id = url.searchParams.get('id');
  if (!id) return Response.json({ ok: false, error: 'no_id' }, { status: 400 });
  if (id === locals.user?.id) return Response.json({ ok: false, error: 'cannot_modify_self' }, { status: 400 });
  const parsed = PatchBody.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  await db.update(users).set({ ...parsed.data, updatedAt: new Date() }).where(eq(users.id, id));
  return Response.json({ ok: true });
};

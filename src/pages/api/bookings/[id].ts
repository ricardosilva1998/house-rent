import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../db/client';
import { bookings } from '../../../db/schema';

export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return Response.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  const id = params.id!;
  const rows = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  const b = rows[0];
  if (!b) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
  if (b.userId !== locals.user.id && locals.user.role !== 'admin') {
    return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  return Response.json({ ok: true, booking: b });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return Response.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  const id = params.id!;
  const rows = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  const b = rows[0];
  if (!b) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
  if (b.userId !== locals.user.id && locals.user.role !== 'admin') {
    return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  if (b.status === 'cancelled') return Response.json({ ok: true, booking: b });
  await db
    .update(bookings)
    .set({ status: 'cancelled', cancelledAt: new Date(), cancelledReason: 'guest_cancelled' })
    .where(eq(bookings.id, id));
  return Response.json({ ok: true });
};

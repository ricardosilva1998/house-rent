import type { APIRoute } from 'astro';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../../../db/client';
import { bookings, auditLog } from '../../../../db/schema';

const PatchBody = z.object({
  status: z.enum(['confirmed', 'cancelled', 'completed', 'no_show']).optional(),
  numGuests: z.number().int().min(1).max(50).optional(),
  specialRequests: z.string().max(1000).nullable().optional(),
  cancelledReason: z.string().max(200).optional(),
  paymentStatus: z.enum(['unpaid', 'partial', 'paid', 'refunded']).nullable().optional(),
  paidAmount: z.number().nonnegative().nullable().optional()
});

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const id = params.id!;
  const parsed = PatchBody.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 });

  const update: any = { updatedAt: new Date() };
  if (parsed.data.status) update.status = parsed.data.status;
  if (parsed.data.status === 'cancelled') {
    update.cancelledAt = new Date();
    update.cancelledReason = parsed.data.cancelledReason ?? 'admin_cancelled';
  }
  if (parsed.data.status === 'completed') update.completedAt = new Date();
  if (parsed.data.numGuests != null) update.numGuests = parsed.data.numGuests;
  if (parsed.data.specialRequests !== undefined) update.specialRequests = parsed.data.specialRequests;
  if (parsed.data.paymentStatus !== undefined) update.paymentStatus = parsed.data.paymentStatus;
  if (parsed.data.paidAmount !== undefined) {
    update.paidAmount = parsed.data.paidAmount;
    if (parsed.data.paidAmount && !update.paymentStatus) update.paidAt = new Date();
  }

  await db.update(bookings).set(update).where(eq(bookings.id, id));
  await db.insert(auditLog).values({
    actorUserId: locals.user?.id ?? null,
    action: 'booking.update_admin',
    entity: 'booking',
    entityId: id,
    metadata: JSON.stringify(parsed.data)
  });
  const rows = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  return Response.json({ ok: true, booking: rows[0] });
};

export const GET: APIRoute = async ({ params }) => {
  const id = params.id!;
  const rows = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  return Response.json({ ok: true, booking: rows[0] ?? null });
};

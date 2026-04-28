import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../../db/client';
import { bookings } from '../../../../db/schema';
import { generateVoucherPdf } from '../../../../lib/voucher';

export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  const id = params.id!;
  const rows = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  const b = rows[0];
  if (!b) return new Response('Not found', { status: 404 });
  if (b.userId !== locals.user.id && locals.user.role !== 'admin') {
    return new Response('Forbidden', { status: 403 });
  }
  const pdf = await generateVoucherPdf({ bookingId: id });
  return new Response(Buffer.from(pdf), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="voucher-${b.confirmationCode}.pdf"`
    }
  });
};

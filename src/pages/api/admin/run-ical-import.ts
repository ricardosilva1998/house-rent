import type { APIRoute } from 'astro';
import { z } from 'zod';
import { importIcalFeed, importAllActiveFeeds } from '../../../lib/ical';

const Body = z.object({ feedId: z.string().optional() });

export const POST: APIRoute = async ({ request }) => {
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  if (parsed.data.feedId) {
    const r = await importIcalFeed(parsed.data.feedId);
    return Response.json({ ok: true, results: [r] });
  }
  const results = await importAllActiveFeeds();
  return Response.json({ ok: true, results });
};

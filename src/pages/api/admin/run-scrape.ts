import type { APIRoute } from 'astro';
import { z } from 'zod';
import { scrapeTarget, scrapeDueTargets } from '../../../jobs/scrape-competitor';

const Body = z.object({ targetId: z.string().optional() });

export const POST: APIRoute = async ({ request }) => {
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  if (parsed.data.targetId) {
    const result = await scrapeTarget(parsed.data.targetId);
    return Response.json({ ok: true, results: [result] });
  }
  const results = await scrapeDueTargets();
  return Response.json({ ok: true, results });
};

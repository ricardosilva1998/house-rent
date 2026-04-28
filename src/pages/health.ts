import type { APIRoute } from 'astro';
import { client } from '../db/client';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    await client.execute('SELECT 1');
    return new Response(JSON.stringify({ ok: true, status: 'healthy' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, status: 'unhealthy' }), {
      status: 503,
      headers: { 'content-type': 'application/json' }
    });
  }
};

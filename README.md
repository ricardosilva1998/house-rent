# Retiro dos Baeta

Vacation rental platform for the Portuguese property [Retiro dos Baeta](https://www.instagram.com/retiro_dos_baeta).
Astro 6 + React 19 + TypeScript + Drizzle (SQLite/libSQL) + Tailwind v4.

## Local development

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run seed:amenities
npm run seed:holidays
npm run create-admin   # interactive prompt
npm run dev
```

Open <http://localhost:4321>. Admin lives at <http://localhost:4321/admin>.

## Deploy to Railway

1. Create a Railway project pointing at this GitHub repo.
2. Provision a Turso database (free tier at <https://turso.tech>) and copy the URL + auth token.
3. In Railway → Variables, set:
   - `PUBLIC_SITE_URL` — your Railway-assigned URL (e.g. `https://retiro.up.railway.app`)
   - `DATABASE_URL` — `libsql://<db>.turso.io`
   - `DATABASE_AUTH_TOKEN` — the Turso auth token
   - `SESSION_SECRET` — `openssl rand -base64 32`
   - `CRON_SECRET` — `openssl rand -base64 32`
   - `RESEND_API_KEY` — get from <https://resend.com>
   - `EMAIL_FROM` — verified sender address
   - `ANTHROPIC_API_KEY` — for AI pricing suggestions (Phase 3)
4. Railway will run `npm run build` then `npm run railway:release && node ./dist/server/entry.mjs`. The release step runs Drizzle migrations on every deploy.
5. After first deploy, run the seeds + create admin via Railway shell:
   ```bash
   railway run npm run seed:amenities
   railway run npm run seed:holidays
   railway run npm run create-admin
   ```

## Project layout

```
src/
  components/        # Astro + React components (islands in /islands)
  db/                # Drizzle schema, client, migrations
  i18n/              # PT/EN/ES dictionaries + helpers
  jobs/              # Scheduled jobs (scrape, ical-import, ai pricing) — phases 3 & 4
  layouts/           # Site + admin shells
  lib/               # auth, email, env, property helpers
  pages/             # Astro routes (filesystem) — public + admin + API
  middleware.ts      # session loader + admin guard
scripts/             # bootstrap + seed CLIs
data/                # local SQLite (gitignored)
```

See `/Users/ricardosilva/.claude/plans/my-idea-with-this-jolly-castle.md` for the full design plan and remaining-phase roadmap.

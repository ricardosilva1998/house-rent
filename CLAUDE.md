# Retiro dos Baeta — house-rent

Vacation rental platform for the Portuguese property *Retiro dos Baeta* (Manteigas, Serra da Estrela). Single property in v1 with a multi-property schema and admin UI ready for more.

**Live**: https://house-rent-production-a7e3.up.railway.app
**Repo**: https://github.com/ricardosilva1998/house-rent
**Plan**: `/Users/ricardosilva/.claude/plans/my-idea-with-this-jolly-castle.md` (the approved design spec all phases were built from)

---

## Stack

- **Astro 6** SSR with `@astrojs/node` (standalone), React 19 islands
- **TypeScript strict**
- **Tailwind v4** via `@tailwindcss/vite`, no `tailwind.config.*`; design tokens in `@theme` inside `src/styles/global.css`
- **Drizzle ORM + libSQL** (`@libsql/client`). Local dev = file-based SQLite at `./data/dev.db`. Production = the same client pointed at Turso.
- **argon2id** password hashing (`@node-rs/argon2`); session cookies (httpOnly, SameSite=Lax)
- **Zod** for input validation everywhere
- **Resend** for transactional email; falls back to console logging in dev
- **Anthropic Claude SDK** for AI price suggestions (Haiku 4.5 default, prompt-cached system)
- **pdf-lib** for booking voucher PDFs
- **node-ical** + **ical-generator** for iCal sync
- **recharts** for the admin stats dashboard

---

## Directory layout

```
src/
  components/
    SiteHeader.astro / SiteFooter.astro       # public chrome
    islands/
      AuthForms.tsx                           # guest login/register/reset
      BookingFlow.tsx                         # calendar + booking widget
    admin/
      AdminAuthForm.tsx                       # admin-only login
      BookingsManager.tsx                     # /admin/bookings table
      UsersManager.tsx                        # /admin/users table
      PropertiesManager.tsx + PropertyEditor.tsx
      PricingManager.tsx                      # 3 tabs: periods / AI suggestions / competitors
      CalendarSyncManager.tsx                 # iCal feeds + conflicts
      StatsDashboard.tsx                      # KPIs + recharts (BarChart, PieChart)
  db/
    schema.ts            # 19 tables (Drizzle)
    client.ts            # createClient + drizzle init; eagerly mkdirs data/ for file: URLs
    migrate.ts           # tsx entrypoint for `npm run db:migrate`
    migrations/          # generated SQL
  i18n/
    pt.json en.json es.json
    use-translation.ts   # createT(locale), pathInLocale, ICU plural support
  jobs/
    scrape-competitor.ts # JSON-LD + meta + admin-supplied regex
    suggest-prices.ts    # Claude (prompt-cached) → price_suggestions
  layouts/
    SiteLayout.astro     # public; loads global.css + Google Fonts
    AdminLayout.astro    # admin shell with sidebar + avatar + logout
  lib/
    auth.ts              # sessions, password hashing, tokens, cookies
    availability.ts      # overlap check across bookings + ical_blocks
    pricing.ts           # quote resolver + confirmation code generator
    voucher.ts           # PDF + .ics builders
    ical.ts              # export + import
    stats.ts             # occupancy / revenue / ADR / lead time / LOS / repeat / monthly
    email.ts             # Resend wrapper with dev console fallback
    env.ts               # zod-validated process.env
    property.ts          # getDefaultProperty + amenities helpers
  middleware.ts          # session loader + role gate
  pages/
    index.astro casa.astro reservar.astro
    en/* es/*            # locale-prefixed mirrors
    conta/                # guest auth pages
    admin/                # admin pages (login.astro is the gate)
    api/                  # all server endpoints (REST-style JSON)
  styles/global.css      # design tokens (@theme), public utilities, admin utilities
scripts/                 # tsx CLIs
  create-admin.ts            # interactive
  seed-admin-from-env.ts     # non-interactive (railway:release uses this)
  seed-amenities.ts          # 15 amenities × 3 locales
  seed-holidays-pt.ts        # PT national holidays for current + next 3 years
  seed-placeholder-content.ts # default property + 10 Unsplash photos + base translations
  seed-mock-data.ts          # 7 guests + 6 pricing periods + 15 bookings (idempotent)
```

---

## Commands

```bash
npm run dev          # astro dev (port 4321 or first free)
npm run build        # production SSR build → dist/
npm run check        # astro check (TypeScript across .astro + .tsx)
npm run db:generate  # drizzle-kit generate (writes new migration SQL)
npm run db:migrate   # apply migrations (mkdirs data/ for file: URLs)
npm run db:studio    # drizzle-kit studio
npm run create-admin # interactive admin bootstrap
npm run seed:amenities
npm run seed:holidays
npm run seed:placeholders
npm run seed:admin   # uses ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD env vars
npm run seed:mock    # 7 guests + 15 bookings (idempotent — skips if any bookings exist)
npm run start        # node ./dist/server/entry.mjs (production)
npm run railway:release
  # full prod chain: migrate → seed amenities → seed holidays
  # → seed placeholders → seed admin → seed mock
```

---

## Environment

Validated by `src/lib/env.ts` (Zod). All optional unless marked required for that capability.

| Var | Purpose |
| --- | --- |
| `PUBLIC_SITE_URL` | Canonical site URL (used in emails + iCal export). |
| `DATABASE_URL` | `file:./data/dev.db` for local; `libsql://…turso.io` for prod. |
| `DATABASE_AUTH_TOKEN` | Turso auth token (only when using libsql://). |
| `SESSION_SECRET` | 32+ chars (HMAC key for session tokens); rotate to invalidate all sessions. |
| `CRON_SECRET` | Required by `/api/cron/*` (`Authorization: Bearer …`). |
| `RESEND_API_KEY` | If unset, emails are printed to stdout (dev fallback). |
| `EMAIL_FROM` | Verified-sender address. |
| `ANTHROPIC_API_KEY` | Required for AI pricing; if unset the suggestion job no-ops. |
| `ANTHROPIC_MODEL` | Default `claude-haiku-4-5-20251001`. |
| `AI_PRICING_MONTHLY_BUDGET_EUR` | Soft cap (default 5). |
| `ADMIN_EMAIL` / `ADMIN_NAME` / `ADMIN_PASSWORD` | Read by `seed:admin` on every release. |
| `HOST` | Astro Node adapter — must be `0.0.0.0` on Railway so the proxy can reach it. |
| `DEFAULT_LOCALE` | `pt` (also defined in astro.config). |

Local: copy `.env.example` → `.env`. Railway: `railway variables --set KEY=value`. Turso: see Deployment.

---

## Auth model

- **Guests** — register/login at `/conta/login` and `/conta/registar`. Email verification required before booking. Password reset works via tokens. Sessions are 30-day cookies (`rdb_session`), token hashed at rest.
- **Admins** — separate `/admin/login`. Form posts to `/api/admin/auth/login` which **rejects non-admin accounts with 403**. Logged-in non-admins hitting `/admin/*` are redirected to `/conta`. The middleware in `src/middleware.ts` is the single source of truth for the role gate.
- API endpoints under `/api/admin/*` return JSON `401`/`403` (not HTML redirects).
- The `/admin/login` URL and `/api/admin/auth/login` are **excluded** from the gate so they can render/respond without a session.

Bootstrap a real admin: `npm run create-admin` (local) or set `ADMIN_*` env vars on Railway and trigger a redeploy.

---

## i18n

- **Languages**: PT (default, no prefix), EN (`/en/*`), ES (`/es/*`).
- Translation dictionaries: `src/i18n/{pt,en,es}.json`.
- Helper: `createT(locale)` returns `t(key, params?)`. Supports a small ICU subset: `{n, plural, one {…} other {…}}` with `#` substituted for the value, plus simple `{var}` substitution.
- Per-property translations live in the `property_translations` table (one row per locale × property): `tagline`, `description`. Same pattern for amenity labels in `amenity_translations`.
- Astro pages mirror across locale directories; relative imports get one extra `..` for the EN/ES copies.

---

## Design system

The public site has an "Editorial Stone" aesthetic; admin uses a denser variant of the same palette.

**Tokens (in `@theme` inside `global.css`):**
- Bone paper: `--color-bone-50/100/200/300`
- Schist (text/dark surfaces): `--color-schist-700/800/900`
- Ember (terracotta accent): `--color-ember-500/600/700`
- Sage (success accent): `--color-sage-500/600`

**Type:**
- Display: **Fraunces** (variable, with SOFT axis), used at large sizes via `.display`, `.display-tight`, `.display-italic`
- Body: **Source Serif 4** (variable, italic axis)
- Mono / numerals / datelines: **IBM Plex Mono**

**Public utilities** (`global.css`): `.dateline`, `.serial`, `.numeral`, `.lede`, `.rule`, `.rule-strong`, `.btn-primary`, `.btn-ghost`, `.field`, `.field-label`, `.photo-card`, `.elink`, `.reveal`/`.reveal-1..5` for staggered intros.

**Admin utilities** (also in `global.css`): `.admin-card`, `.admin-card-header`, `.admin-card-title`, `.admin-table`, `.chip` + `.chip-{confirmed,completed,cancelled,no_show,paid,unpaid,partial,refunded,admin,guest}`, `.btn-action`, `.btn-action-danger`, `.btn-action-soft`, `.admin-input`, `.admin-select`, `.admin-textarea`, `.admin-label`, `.admin-empty`.

**Conventions:**
- Tables: monospace numerals, hairline rules between rows, hover row tint in ember at 4%, status chips for state.
- Editorial drop-cap on `.lede` first letter (ember).
- Subtle SVG paper-grain overlay on public pages via `body::before`.
- All buttons get `cursor: pointer` and a 160ms colour transition.

---

## Database

**19 tables** (full list in `src/db/schema.ts`):

- Auth: `users`, `user_tokens`, `sessions`
- Property: `properties`, `property_translations`, `property_photos`, `amenities`, `amenity_translations`, `property_amenities`
- Pricing: `pricing_periods`, `price_suggestions`, `competitor_targets`, `competitor_snapshots`
- Bookings: `bookings` (with reserved nullable `payment_status`/`paid_amount`/`paid_at` for future Stripe)
- Sync: `ical_feeds`, `ical_blocks`
- Misc: `audit_log`, `holidays`, `settings`

Date conventions: calendar columns (`check_in`, `check_out`, `start_date`, `end_date`, `date`) are SQLite `text` storing ISO `YYYY-MM-DD`. Timestamps (`*_at`) are SQLite `integer` storing Unix epoch ms via Drizzle `mode: 'timestamp_ms'`. IDs are `text` with `cuid2()` defaults.

To add/alter a table: edit `src/db/schema.ts`, run `npm run db:generate`, commit the generated SQL, then `npm run db:migrate`.

---

## API surface

Public:
- `POST /api/auth/{register,login,logout,verify-email,request-password-reset,reset-password}` and `GET /api/auth/me`
- `GET /api/availability?from&to`
- `GET /api/quote?from&to&guests`
- `POST/GET /api/bookings`, `GET/DELETE /api/bookings/[id]`, `GET /api/bookings/[id]/voucher`
- `GET /ical/[token].ics`
- `GET /health`

Admin (all gated by middleware to `role=admin` and return JSON 401/403):
- `POST /api/admin/auth/login`
- `GET/PUT /api/admin/property` (multi-property aware via `?id=`), `POST` to create, `DELETE?id` (blocks if has bookings)
- `GET/POST/PATCH/DELETE /api/admin/photos` and `GET/PUT /api/admin/amenities` (both accept `?propertyId=`)
- `GET/POST /api/admin/pricing-periods`, `PATCH/DELETE /api/admin/pricing-periods/[id]`
- `GET/POST /api/admin/competitor-targets`, `PATCH/DELETE /api/admin/competitor-targets/[id]`
- `GET/PATCH /api/admin/price-suggestions`
- `GET /api/admin/ical-conflicts`, `GET/POST /api/admin/ical-feeds`, `PATCH/DELETE /api/admin/ical-feeds/[id]`
- `POST /api/admin/run-scrape`, `POST /api/admin/run-suggest`, `POST /api/admin/run-ical-import`
- `GET/POST /api/admin/bookings`, `GET/PATCH /api/admin/bookings/[id]`
- `GET/PATCH /api/admin/users` (PATCH toggles role)
- `GET /api/admin/stats?from&to`

Cron (`Authorization: Bearer $CRON_SECRET`):
- `GET/POST /api/cron/scrape-competitors`
- `GET/POST /api/cron/suggest-prices?days=N`
- `GET/POST /api/cron/ical-import`

---

## Deployment

**Railway**:
- Project: `retiro-dos-baeta`. Service: `house-rent` linked to `ricardosilva1998/house-rent` GitHub repo (auto-deploys on push to `main`).
- `railway.toml` runs `npm run build`, then on start: `npm run railway:release && node ./dist/server/entry.mjs`. The release step migrates and reseeds.
- `HOST=0.0.0.0` is required on Railway (Astro Node adapter binds localhost otherwise).
- Health check: `/health`.

**Turso (still pending — see "Deferred" below):**
- Sign up at https://turso.tech, create a `retiro-dos-baeta` DB in `fra` (Frankfurt).
- `turso db show retiro-dos-baeta --url` → `DATABASE_URL`
- `turso db tokens create retiro-dos-baeta` → `DATABASE_AUTH_TOKEN`
- Set both on Railway, redeploy. The migrate step will run against Turso; subsequent `railway run` commands will hit the same DB.

Until Turso is wired up, the prod DB is the container's ephemeral SQLite — every redeploy resets data and the seeds re-run. Seeds are idempotent so the property + photos + amenities + admin re-appear; new live bookings/users created in production do **not** survive a redeploy.

---

## Mock data (production)

`scripts/seed-mock-data.ts` runs as part of `railway:release`. Idempotent (skips if bookings already exist).

**Guests** (all `password = <name>1234`):

- `maria@example.com` (Maria Costa, PT) — 3 bookings, has past + upcoming
- `pierre@example.com` (Pierre Martin, FR) — 3 bookings
- `anna@example.com` (Anna Schmidt, DE) — 2 bookings
- `raquel@example.com` (Raquel Santos, PT) — 2 bookings
- `carlos@example.com` (Carlos García, ES) — 2 bookings
- `emma@example.com` (Emma Wilson, GB) — 2 bookings
- `joao@example.com` (João Pereira, PT) — 1 booking

**Admin** (mock): email set via `ADMIN_EMAIL` Railway variable. Password set via `ADMIN_PASSWORD` Railway variable — do not commit a real password here; rotate via `railway variables --set ADMIN_PASSWORD=…`.

Yields: 15 bookings (10 completed + 5 upcoming), ~13k EUR revenue, 86% repeat rate, 5 origin countries, 14 monthly buckets — enough to make the stats dashboard look alive.

---

## Conventions worth knowing

- **Astro page authors** prefer `cat > … <<'EOF'` heredocs to avoid double-handling the brace-escape rules of TSX inside Astro templates.
- **Bracketed paths** (`[id].ts`) must be **single-quoted** in shell, otherwise zsh tries to glob.
- **Astro redirects must use relative paths** (`/admin/login?next=…`), not absolute. `context.url` is the internal container URL on Railway, so building absolute URLs leaks `localhost:8080` to the browser.
- **Locale routing**: pages duplicated under `src/pages/{en,es}/`. Imports get one extra `..`. Helper `pathInLocale(path, locale)` produces correct hrefs.
- **i18n format helper** supports the ICU plural subset `{n, plural, one {…} other {…}}`. Don't write more complex ICU expressions in the JSON; lift them into JS callers instead (see `src/pages/reservar.astro`'s `nightsLabel`).
- **Booking conflicts** are checked in two places: a fast pre-check before insert, then the same check inside the same request (libSQL doesn't expose serializable transactions over libSQL HTTP). For high concurrency this should be tightened to an atomic SQL `INSERT … WHERE NOT EXISTS`, but at single-property volume it's fine.
- **Multi-property** is schema-complete. Public pages always use the first-by-`createdAt` property (the one tagged `Pública` in `/admin/property`). Admin can add/edit/delete others; the `Pública` one is protected from deletion.
- **Mock data idempotency**: `seed-placeholder-content` skips photos when **any** photo exists; `seed-mock-data` skips bookings when **any** booking exists. Run them after deleting from those tables to re-seed.

---

## Phase status (per the approved plan)

- ✅ Phase 1 — Foundation (Astro + auth + i18n + property CRUD + public pages)
- ✅ Phase 2 — Booking core (availability, calendar, voucher PDF, admin bookings)
- ✅ Phase 3 — Pricing & AI (seasonal periods, scraper, Claude suggestions, admin UI)
- ✅ Phase 4 — iCal sync (export feed, import job, conflict view)
- ✅ Phase 5 — Statistics dashboard (occupancy, ADR, repeat rate, monthly chart)

## Deferred

- **Turso wiring** — production is still on the container's ephemeral SQLite. Set `DATABASE_URL` + `DATABASE_AUTH_TOKEN` on Railway to switch.
- **Stripe / MB Way** — schema columns reserved (`payment_status`, `paid_amount`, `paid_at`); admins can manually mark paid in the meantime.
- **Real Instagram photos** — placeholders are CC0 Unsplash images. Instagram CDN URLs expire and IG actively blocks scrapers; the path forward is uploading the owner's real photos to a stable host (Cloudinary, Bunny, S3, or `public/photos/`).
- **House rules / cancellation policy translations** — currently single-language strings on `properties`; should move into `property_translations` with new columns to avoid PT bleed-through on EN/ES `/casa`.
- **Co-host roles, reviews, loyalty/coupons, SMS** — out of scope for v1.

---

## Where to look first

- Want to add a new admin page? → `src/pages/admin/<name>.astro` + a `src/components/admin/<Name>Manager.tsx` island, backed by a `src/pages/api/admin/<name>.ts` endpoint. Use `.admin-card` + `.admin-table` + `.btn-action`.
- Want to change copy that's in 3 languages? → `src/i18n/{pt,en,es}.json`.
- Want to add a property field? → schema → migration → propagate to `/api/admin/property` PUT body validator → `PropertyEditor.tsx`.
- Want to add a new email template? → `src/lib/email.ts` (export a `render*Email` function and call it from the API endpoint that needs it).


## Team Activity Log

This section is the shared coordination surface for the dev team (team-leader + frontend-dev + backend-dev + team-security + team-qa + team-ux + team-deployment). Every team member reads the last few entries before working and appends one entry after.

Format per entry:

```
### YYYY-MM-DD HH:MM — <role>
**Task:** <one line>
**Files:** <comma-separated paths or "none">
**Decisions:** <2-4 bullets the next teammate needs to know>
**Open:** <followups, or "none">
```

### 2026-04-29 14:00 — team-ux
**Mode:** audit
**Task:** UX/UI audit (read-only) — public site (/, /casa, /reservar, /conta/*) + admin UI
**Files:** none (read-only)
**Decisions:**
- Critical: StatsDashboard.tsx, PropertiesManager.tsx, CalendarSyncManager.tsx, and PropertyEditor.tsx use raw Tailwind utility classes with hardcoded stone/gray/white/emerald/amber/red colors instead of the project's bone/schist/ember/sage token system. All four must be ported to the existing admin utilities (admin-card, admin-table, admin-input, admin-label, btn-action).
- The SiteHeader has no mobile hamburger/collapse: at 360px the nav links plus locale switcher plus auth control are one flat flex row that will overflow or be unreachably small. Needs a responsive collapse at md breakpoint.
- The admin sidebar (AdminLayout.astro) is `w-64 shrink-0` with no responsive adaptation — it produces horizontal scroll on viewports below ~800px (tablet access to admin is broken). Needs a collapsible drawer or at minimum a responsive hide below lg.
- BookingFlow calendar day cells are `aspect-square` with no minimum size floor — at 360px they will fall well below 44×44px touch targets. Needs `min-w-[44px] min-h-[44px]` or equivalent.
**Open:** Full prioritized fix list delivered inline in Round 1 return message to team-leader.

### 2026-04-29 16:45 — frontend-dev
**Task:** Implement UX fixes from team-ux Round 1 (P0 mobile nav + admin sidebar, P1 admin token system + a11y, P2 polish)
**Files:** src/layouts/AdminLayout.astro, src/components/SiteHeader.astro, src/components/admin/StatsDashboard.tsx, src/components/admin/PropertiesManager.tsx, src/components/admin/CalendarSyncManager.tsx, src/components/admin/PropertyEditor.tsx, src/components/islands/BookingFlow.tsx, src/pages/reservar.astro, src/pages/en/reservar.astro, src/pages/es/reservar.astro, src/pages/conta/index.astro, src/components/islands/AuthForms.tsx, src/components/SiteFooter.astro, src/styles/global.css
**Decisions:**
- P0: AdminLayout now has a hamburger + full-screen drawer sidebar (hidden below lg, fixed overlay with close button + backdrop click to dismiss). SiteHeader now has a hamburger + full-screen mobile menu below md, with locale switcher and auth links inside.
- P1: All four admin components (StatsDashboard, PropertiesManager, CalendarSyncManager, PropertyEditor) fully ported to `.admin-card`, `.admin-input`, `.admin-label`, `.admin-table`, `.btn-action`, `.chip-confirmed`, token colors. BookingFlow: 44px min-height on day cells, sticky bottom CTA bar on mobile, `labels.account` for success screen, `role="alert"` on error, `<abbr>` day-of-week labels. Dates in `/conta` now formatted DD/MM/YY. `aria-label` on admin nav (P1-9) and `aria-current` on locale links (P1-10) both shipped.
- P2: `.btn-ghost` gets `cursor:pointer` + transition. `.field:focus-visible` gets ember glow box-shadow (outline:none removed). `role="alert"` on AuthForms error/success. SiteFooter link columns wrapped in `<nav aria-label>`. `/conta` max-width corrected to 1320px.
- Skipped P2-5, P2-6, P2-10 (nice-to-haves per brief). `any` preserved on recharts `<Pie label>` prop — recharts types are too narrow for the render prop pattern; this matches the pre-existing pattern in the file.
**Open:** team-qa should smoke-test mobile nav at 360px (hamburger open/close, overlay tap dismiss), the sticky BookingFlow CTA bar on mobile, and the admin sidebar drawer on tablet. The `pathInLocale` unused-import warning on conta/index.astro and its locale mirrors is pre-existing (not introduced by this round).

### 2026-04-29 14:30 — team-security
**Task:** Security audit (read-only) — auth + API + cron + AI + iCal surface
**Files:** none (read-only)
**Decisions:**
- CRITICAL: No rate limiting anywhere — login, register, password-reset, booking POST, cron, and AI-pricing endpoints are all unthrottled; brute-force and direct API abuse can exhaust Anthropic budget.
- HIGH: `SESSION_SECRET` is validated by env.ts but never consumed — session tokens are stored as plain SHA-256 hashes with no HMAC keying; the secret provides zero protection today. `CRON_SECRET` comparison uses plain string equality (not timing-safe).
- HIGH: No HTTP security headers at all (no CSP, no X-Frame-Options, no X-Content-Type-Options, no HSTS, no Referrer-Policy); site is frameable and lacks any XSS policy layer.
- HIGH: SSRF — admin can register arbitrary URLs as iCal feeds and competitor scrape targets; both trigger server-side fetches with no allowlist or private-IP block.
**Open:** Full prioritized fix list delivered inline in Round 1 return message to team-leader. Mock data passwords in seed-mock-data.ts are intentionally weak for demo — acceptable. argon2id params (19 MiB / t=2) meet OWASP minimums. No raw SQL injection risk found (all Drizzle parameterized).

### 2026-04-29 17:30 — team-security
**Task:** Implement security fixes (rate limit, HMAC sessions, timing-safe cron, CSP/headers, SSRF guard, SQL LIKE escape, env hardening)
**Files:** src/lib/rate-limit.ts, src/lib/net.ts, src/lib/cron-auth.ts, src/lib/auth.ts, src/lib/env.ts, src/lib/email.ts, src/lib/ical.ts, src/middleware.ts, src/pages/api/cron/scrape-competitors.ts, src/pages/api/cron/suggest-prices.ts, src/pages/api/cron/ical-import.ts, src/pages/api/admin/ical-feeds.ts, src/pages/api/admin/competitor-targets.ts, src/pages/api/admin/users.ts, src/pages/api/admin/bookings.ts, src/pages/ical/[token].ics.ts, src/jobs/scrape-competitor.ts, scripts/seed-mock-data.ts, .env.example, CLAUDE.md
**Decisions:**
- ALL EXISTING SESSIONS WILL BE INVALIDATED ON DEPLOY — hashToken() now uses HMAC-SHA256(SESSION_SECRET) instead of plain SHA-256; stored hashes in the sessions and user_tokens tables will not match. Users will be silently logged out and prompted to log in again. This is intentional and expected.
- SESSION_SECRET minimum length raised from 16 to 32 chars. If the current Railway SESSION_SECRET is shorter than 32 chars, the app will refuse to start with "Invalid environment" until it is rotated. Set via: railway variables --set SESSION_SECRET=$(openssl rand -base64 32)
- SSRF guard (assertPublicUrl) is defence-in-depth at two layers: (1) POST validation in ical-feeds and competitor-targets before DB insert; (2) inside importIcalFeed() and fetchHtml() before the actual network call, covering URLs inserted before this fix.
- scrape-competitor.ts redirect mode changed from 'follow' to 'manual' — the scraper now rejects 3xx redirects (returns error 'redirect_not_followed:301/302'). Legitimate competitor pages that use a redirect chain will need to be re-registered with their final URL. QA should verify the scraper still works on at least one active competitor target.
- CSP 'unsafe-inline' for scripts is required by Astro 6 hydration islands (inline script tags). This is the accepted posture; document for follow-up when Astro ships nonce support.
**Open:** Tests for rate-limit, SSRF, and HMAC session deferred — no test runner in repo. npm audit package CVE follow-up deferred (no high/critical found in this round). Redirect-following SSRF in scraper is now blocked entirely rather than re-validated — a more permissive approach (re-validate redirect target) is possible but adds complexity; current posture is safer.

### 2026-04-29 16:50 — team-qa
**Task:** Verification of Rounds 1+2 (UX fixes by frontend-dev + security hardening by team-security)
**Files:** none (verification-only; no source files modified)
**Decisions:**
- VERDICT: YELLOW — deploy with caveats. Typecheck is green (0 errors, 0 warnings, 40 pre-existing hints — identical to prior rounds). Dev server boots cleanly with the default dev SESSION_SECRET (>=32 chars). All security controls verified correct via static review and live smoke tests: rate limiting enforces 5-req/60s on login (confirmed via curl — 6th request returns 429); CSP + X-Frame-Options + HSTS + Referrer-Policy + Permissions-Policy headers present on every response; assertPublicUrl called before nodeIcal.async.fromURL in ical.ts and before fetch() in scrape-competitor.ts; redirect:'manual' set in fetchHtml; escapeLike + .limit(200) in both admin/users.ts and admin/bookings.ts; production guard is the first line of seed-mock-data.ts; iCal export sets cache-control: private, no-store; HMAC-SHA256 hashToken uses createHmac with SESSION_SECRET; timingSafeEqual in cron-auth.ts pads to equal length correctly.
- BLOCKER: CLAUDE.md environment table still documents SESSION_SECRET as "16+ chars" (line 119) — it is now enforced at 32+. This is documentation drift only; env.ts is correct. team-leader or backend-dev should update that table line before deploy to avoid confusing the next operator.
- DEPLOY BLOCKER: If the Railway SESSION_SECRET variable is shorter than 32 chars the app will refuse to start (env.ts throws "Invalid environment"). Must rotate before deploy: `railway variables --set SESSION_SECRET=$(openssl rand -base64 32)`. This invalidates all live sessions — users will be logged out once on next deploy.
- No project-level test files exist despite vitest being registered in package.json. `npm run test` exits 1 with "No test files found". This is a pre-existing gap, not a regression introduced this round.
**Open:** (1) CLAUDE.md env table: update SESSION_SECRET docs from "16+" to "32+". (2) Browser-level verification of mobile nav hamburger, admin sidebar drawer, BookingFlow sticky CTA, and 44px touch targets was NOT performed — no browser tools were dispatched; team-ux or a manual QA pass should confirm these before a customer-facing release. (3) scrape-competitor redirect:'manual' change means any registered competitor target using HTTP-to-HTTPS redirects will now return an error — operator must re-register those targets with their final HTTPS URL. (4) vitest is registered but has 0 test files — recommend adding at minimum unit tests for rate-limit.ts, net.ts assertPublicUrl, and auth.ts hashToken as a follow-up task.

### 2026-04-29 18:15 — team-deployment
**Task:** Deploy house-rent to Railway after Rounds 1-3 (UX + security hardening)
**Files:** none (all code committed; no code changes made by this role)
**Decisions:**
- Pre-deploy SESSION_SECRET check PASSED: Railway production SESSION_SECRET is 43 chars (>= 32 required). Hard gate cleared.
- Secrets scan clean: staged diff contains only .env.example placeholders and CLAUDE.md documentation strings — no real credentials.
- Committed 34 files as 7f4dfb4 on main (31 modified + 3 new: src/lib/cron-auth.ts, src/lib/net.ts, src/lib/rate-limit.ts). Pushed to origin/main (64d257d → 7f4dfb4).
- Railway deploy BLOCKED: `railway up` returns "Deploys have been paused temporarily". This is a Railway platform-side condition (service manually paused, billing/usage limit, or temporary platform outage). The current running deployment (pre-round) is still live and healthy on port 8080. New code is on GitHub at 7f4dfb4 but NOT yet live in production.
**Open:** User must resolve the Railway deploy pause before the rounds 1-3 code ships. To investigate: open https://railway.app → retiro-dos-baeta → house-rent service → check if deploys are paused or if there is a billing/usage notice. Once unpaused, either re-run `/dev-team house-rent deploy` OR trigger manually via `railway up` (the code is already committed and pushed). All-session invalidation (HMAC hashToken change) will occur on the NEXT successful deploy. Monitor for user-facing login-state errors post-deploy.

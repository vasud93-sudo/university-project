# Extracurricular Activities Portal

A self-contained web app for the Career Counselling team: publish
competitions/scholarships/programs with deadlines, auto-remind students by
email, bulk-send specific opportunities to a class, let students browse and
shortlist activities (with an Excel export), and see who clicked through and
who self-reported registering.

Built with Next.js (App Router) + Prisma + NextAuth. It's a separate,
self-contained app inside this repo — it doesn't share any code with the
university-catalog static site at the repo root.

## What's included

- **Admin**: create/edit/publish activities, a live "who clicked / who
  registered" tracking dashboard with Excel export, a roster manager (CSV
  upload), and a bulk-send tool to push one activity to a class instantly.
- **Automatic reminders**: every published activity gets three emails —
  5 days before its deadline, halfway between when registration opens and
  the deadline, and on the deadline day itself. A daily cron endpoint drives
  this in production; there's also an admin "run now" button, and it's safe
  to re-run (never double-sends the same reminder to the same student).
- **Student portal**: browse/filter activities by category and grade,
  shortlist favorites, export the shortlist to `.xlsx`, and self-report
  "I've registered" on an activity's page.
- **Click tracking**: every activity link (in emails and on the site) routes
  through `/go/[id]`, which logs who clicked before forwarding to the real
  registration page.

It ships seeded with 7 real activities pulled from the school's own Term 1
2026–27 communications document (Harvard Science Olympiad, RNMC, INSPIRE
Awards, PSAT, IOQM, etc.), a demo student roster across grades 6–12, and a
demo admin account — so you can see the whole thing working immediately.

## Quick start (demo mode, no external accounts needed)

```bash
cd extracurricular-portal
npm install
npx prisma migrate dev   # creates dev.db
npm run db:seed          # loads the demo activities, roster & admin
npm run dev
```

Open http://localhost:3000/login. Demo mode (`DEMO_MODE=true`, already set
in `.env`) enables a no-password login — sign in as:

- **`admin@fountainheadschools.org`** — the admin dashboard
- **`aarav.mehta@fountainheadschools.org`** (or any other seeded student
  email — see `prisma/seed.ts`) — the student portal

In demo mode, emails aren't actually sent — they're logged to the terminal
running `npm run dev`, and every send still creates the same database
records the admin UI reads from (so the "Reminders" and "Tracking" pages
behave exactly as they would in production).

## Four things worth trying right away

1. **Admin → Reminders**: click "Run today's reminders now". Because the
   demo data includes an activity (IOQM) whose 5-day-before-deadline mark
   lands on today's date, you'll see it actually send.
2. **Admin → Bulk send**: pick an activity, pick a class from the roster (or
   paste emails), send.
3. **Student → Browse**: filter by category, shortlist a couple of
   activities, then go to **My shortlist** and export to Excel.
4. **Admin → Tracking**: after clicking an activity link as a student and/or
   marking "I've registered", check this page (and its Excel export) to see
   it recorded per student.

## Deploying on Railway

Railway runs this as a real, always-on server (unlike GitHub Pages/Vercel's
static hosting, it's not "static" — it keeps a Node process running, which
is what lets the reminder cron and file-based SQLite actually work). Steps:

1. **New Project → Deploy from GitHub repo** → pick this repo. In the
   service's **Settings → Root Directory**, set it to `extracurricular-portal`
   (this app lives in a subfolder, not the repo root).
2. Railway auto-detects Next.js via Nixpacks and picks up `railway.json` in
   this folder, which sets the start command to
   `npm run start:railway` (runs `prisma migrate deploy` — applying the
   already-committed migration — then starts the server).
3. **Add a Volume** (Settings → Volumes) mounted at `/data`, so the SQLite
   database file survives restarts and redeploys (container disk is wiped
   on every deploy otherwise). Skip this step entirely if you'd rather use
   Postgres — see the alternative below.
4. **Set environment variables** (Settings → Variables):
   ```
   DATABASE_URL=file:/data/prod.db
   AUTH_SECRET=<openssl rand -base64 32>
   ADMIN_EMAILS=<your real admin email(s), comma-separated>
   PORTAL_URL=https://<the-domain-railway-gives-you>.up.railway.app
   DEMO_MODE=false
   ```
   Add `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` and
   `RESEND_API_KEY`/`MAIL_FROM` (or `SMTP_*`) once you have them — see the
   sections below. Leaving them unset keeps demo-login/console-email mode,
   which still works fine on Railway if you want to share a working preview
   before wiring up real login/email.
5. **Deploy.** Once it's live, seed it once: Railway dashboard → your
   service → the **⋯ menu → Run Command** (or `railway run` from the CLI if
   you have it linked locally) → `npm run db:seed`.
6. **Reminder cron**: Railway doesn't have Vercel's per-route cron, but it
   does let a service run on a schedule. Add a **second, tiny service** in
   the same project: same repo/root directory, but under that service's
   **Settings → Cron Schedule** set e.g. `0 8 * * *` (daily 08:00 UTC), and
   its start command to just:
   ```
   curl -sf -H "Authorization: Bearer $CRON_SECRET" https://<your-app-domain>/api/cron/reminders
   ```
   (set `CRON_SECRET` on both services to the same value). This second
   service doesn't need the volume or most of the env vars — just enough to
   build, which on Railway's Nixpacks means it's simplest to give it a
   trivial custom build (or point it at a tiny separate script) rather than
   rebuilding the whole app just to run one `curl`. If that's more setup
   than you want right now, any external scheduler (cron-job.org, a GitHub
   Actions scheduled workflow) hitting the same URL works just as well and
   is simpler to wire up first.

**Postgres instead of the SQLite volume** (recommended once you outgrow a
single-instance demo — needed if you ever scale to more than one replica):
Railway can provision a Postgres database in the same project
(**New → Database → PostgreSQL**), which gives you a `DATABASE_URL`
automatically. To use it, change `prisma/schema.prisma`'s `datasource`
`provider` from `sqlite` to `postgresql`, delete `prisma/migrations/`, and
run `npx prisma migrate dev --name init` once **against that real Postgres
URL** (locally, with `DATABASE_URL` pointed at it) to generate a
Postgres-flavored initial migration — commit that, then Railway's
`prisma migrate deploy` (already wired into `start:railway`) applies it on
every deploy from then on.

## Moving from demo to a real deployment (any host)

The Railway section above is the fastest path; everything below applies
wherever you end up hosting it — nothing in the code changes, only
environment variables (see `.env.example`).

### 1. Database

Any Postgres host works the same way as the Railway Postgres option above —
set `DATABASE_URL`, switch the schema provider, regenerate migrations
against it once. Neon and Supabase both have a free tier.

### 2. Google Sign-In (for real student/staff login)

1. In Google Cloud Console, create an OAuth 2.0 Client ID (Web application).
2. Authorized redirect URI: `https://<your-domain>/api/auth/callback/google`.
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and unset `DEMO_MODE`.
4. If everyone should be restricted to the school's Google Workspace domain,
   uncomment the `hd` option in `src/lib/auth.ts`'s Google provider config.

The **first** person who signs in with an email listed in `ADMIN_EMAILS`
(comma-separated) becomes an admin automatically; everyone else becomes a
student. You can promote/demote anyone later by editing their `role`
directly in the database.

### 3. Email sending

Pick one (leaving both unset keeps demo/console mode):

- **Resend** (simplest): create a free account, verify a sending domain,
  set `RESEND_API_KEY` and `MAIL_FROM`.
- **SMTP** (e.g. a Google Workspace account with an app password): set
  `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.

See `src/lib/mailer.ts` — this is the only file that would need to change to
add another provider.

### 4. Daily reminder cron

On Railway, see the cron step in the Railway section above. `vercel.json` is
also included, which schedules `/api/cron/reminders` daily at 08:00 UTC if
you deploy on Vercel instead — no extra setup there. On any other host: hit
that same URL once a day from any scheduler (cron-job.org, a GitHub Actions
scheduled workflow, etc.), sending header
`Authorization: Bearer $CRON_SECRET` if you've set `CRON_SECRET`
(recommended, so randoms can't trigger it).

### 5. Roster

Upload your real student list from **Admin → Roster** (CSV: `name, email,
grade, section`). Re-uploading updates existing students by email, so it's
safe to refresh each term.

## Known placeholders in the seed data

Four of the seeded activities (HUSO, RNMC, Salamanca camp, ILO) had a
"Click Here"-style button in the source document rather than a plain URL,
so their `link` field is an `https://example.com/...` placeholder — each
one is flagged in its "internal note" field in the admin edit form. Replace
these with the real URLs before actually publishing to students. The other
three (INSPIRE Awards, PSAT, IOQM) have real links captured from the source
document.

## Project structure

```
prisma/schema.prisma        data model (Activity, Cluster, User, ReminderLog,
                             BulkSend, ActivityClick, RegistrationSelfReport,
                             Shortlist)
prisma/seed.ts               demo data loader
src/lib/reminders.ts         pure date-math for the 3 reminder types
src/lib/reminder-service.ts  DB + email orchestration for reminders
src/lib/mailer.ts            pluggable email backend (console/Resend/SMTP)
src/lib/excel.ts             .xlsx generation (shortlist & tracking exports)
src/lib/auth.ts              NextAuth config (Google + demo-mode credentials)
src/app/admin/...            admin dashboard (activities, reminders,
                             bulk-send, tracking, roster)
src/app/browse, /activity,
  /shortlist                 student portal
src/app/go/[id]              click-tracked redirect to the real registration link
src/app/api/cron/reminders   daily reminder job entry point
```

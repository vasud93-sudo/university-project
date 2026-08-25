# Extracurricular Activities Portal

A self-contained web app for the Career Counselling team: publish
competitions/scholarships/programs with deadlines, auto-remind students by
email, bulk-send specific opportunities to a class, let students browse and
shortlist activities (with an Excel export), and see who clicked through and
who self-reported registering.

Built with Next.js (App Router) + Prisma (Postgres) + NextAuth. It's a
separate, self-contained app inside this repo — it doesn't share any code
with the university-catalog static site at the repo root.

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

This app needs a real, always-running server (not static hosting like
GitHub Pages) because reminders, logins, tracking, and bulk-send all require
code that runs continuously and a real database — none of that can exist in
plain HTML/CSS/JS.

## 1. Get a free Postgres database (needed even to run this locally)

The app needs Postgres — there's no zero-setup local-file fallback. The
free tier of either works fine for this project's scale:

- **[Neon](https://neon.tech)** (recommended) — sign up, create a project,
  copy the connection string it gives you (starts with `postgresql://`).
- **[Supabase](https://supabase.com)** — same idea, under
  Project Settings → Database → Connection string.

Either way, no credit card is required for the free tier as of writing —
double check on their pricing pages, since that can change.

## 2. Run it locally

```bash
cd extracurricular-portal
npm install
cp .env.example .env        # then paste your real DATABASE_URL into it
npx prisma migrate deploy   # applies the committed migration
npm run db:seed             # loads the demo activities, roster & admin
npm run dev
```

Open http://localhost:3000/login. Demo mode (`DEMO_MODE=true`, already set
in `.env.example`) enables a no-password login — sign in as:

- **`admin@fountainheadschools.org`** — the admin dashboard
- **`aarav.mehta@fountainheadschools.org`** (or any other seeded student
  email — see `prisma/seed.ts`) — the student portal

In demo mode, emails aren't actually sent — they're logged to the terminal
running `npm run dev`, and every send still creates the same database
records the admin UI reads from (so the "Reminders" and "Tracking" pages
behave exactly as they would in production).

### Four things worth trying right away

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

## 3. Deploying on Vercel (recommended — free)

1. **[vercel.com](https://vercel.com) → Add New → Project** → import
   `vasud93-sudo/university-project` from GitHub.
2. In the import screen's **Root Directory**, set it to
   `extracurricular-portal` (this app lives in a subfolder, not the repo
   root).
3. **Environment Variables** — add:
   ```
   DATABASE_URL=<your Neon/Supabase connection string>
   AUTH_SECRET=<run: openssl rand -base64 32>
   ADMIN_EMAILS=<your real admin email(s), comma-separated>
   PORTAL_URL=https://<the domain Vercel gives you>.vercel.app
   DEMO_MODE=false
   ```
   Add `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` and
   `RESEND_API_KEY`/`MAIL_FROM` (or `SMTP_*`) once you have them — see
   sections 5–6 below. Leaving them unset keeps demo-login/console-email
   mode, which still works fine if you want to share a working preview
   before wiring up real login/email.
4. **Deploy.** `vercel.json`'s `buildCommand` already runs
   `prisma migrate deploy` before `next build`, so the database schema is
   applied automatically on first deploy — no manual migration step needed.
5. **Seed it once**: easiest from your own machine —
   `DATABASE_URL=<the same connection string> npm run db:seed` — since the
   seed script just needs to reach the database, not the deployed app.
6. **Reminder cron**: already wired up. `vercel.json` schedules
   `/api/cron/reminders` daily at 08:00 UTC automatically on Vercel — no
   extra setup.

## 4. Deploying elsewhere (Railway, Render, Fly.io, a VPS…)

Nothing about the app is Vercel-specific — it's a standard Next.js server.
Moving (now or later) is: point the new host at the same GitHub repo (root
directory `extracurricular-portal`), set the same environment variables
(reuse the same Neon/Supabase `DATABASE_URL`, or provision a new Postgres
on the new host instead), and deploy. The only Vercel-specific piece is the
cron mechanism in `vercel.json` — everywhere else, hit
`/api/cron/reminders` daily from whatever scheduler that host offers (or an
external one like cron-job.org / a GitHub Actions scheduled workflow),
sending header `Authorization: Bearer $CRON_SECRET` if you've set
`CRON_SECRET` (recommended, so randoms can't trigger it).

`railway.json` is included for exactly this — Railway auto-detects it and
runs `npm run start:railway` (`prisma migrate deploy && next start`) with
no extra config beyond the environment variables above.

## 5. Google Sign-In (for real student/staff login)

1. In Google Cloud Console, create an OAuth 2.0 Client ID (Web application).
2. Authorized redirect URI: `https://<your-domain>/api/auth/callback/google`.
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and unset `DEMO_MODE`.
4. If everyone should be restricted to the school's Google Workspace domain,
   uncomment the `hd` option in `src/lib/auth.ts`'s Google provider config.

The **first** person who signs in with an email listed in `ADMIN_EMAILS`
(comma-separated) becomes an admin automatically; everyone else becomes a
student. You can promote/demote anyone later by editing their `role`
directly in the database.

## 6. Email sending

Pick one (leaving both unset keeps demo/console mode):

- **Resend** (simplest): create a free account, verify a sending domain,
  set `RESEND_API_KEY` and `MAIL_FROM`.
- **SMTP** (e.g. a Google Workspace account with an app password): set
  `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.

See `src/lib/mailer.ts` — this is the only file that would need to change to
add another provider.

## 7. Roster

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

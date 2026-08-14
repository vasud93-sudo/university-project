# US University Catalog

A free, static, filterable catalog of US universities, built on Department of
Education College Scorecard data. Students filter by state, cost, admission
rate, etc., "pull" cards into a shortlist, and export it as a CSV to build
their own sheet.

No backend, no database, no paid services required.

## What's in here

```
index.html   → page structure
style.css    → card-catalog visual theme
app.js       → filtering, sorting, shortlist, CSV export (all client-side)
data/schools.json     → the dataset the site reads (sample data included)
scripts/fetch-data.js → pulls real data from the College Scorecard API
.github/workflows/refresh-data.yml → auto-refreshes data monthly
```

## 1. Try it locally right now

The repo ships with a ~30-school sample dataset so you can see it working
immediately, no setup needed:

```bash
# any static file server works, e.g.:
npx serve .
# then open the printed localhost URL
```

## 2. Pull the real, full dataset

1. Get a free API key: https://api.data.gov/signup/ (usually approved instantly)
2. Run the fetch script with your key:
   ```bash
   COLLEGE_SCORECARD_API_KEY=your_key_here node scripts/fetch-data.js
   ```
   This overwrites `data/schools.json` with the full set of currently
   operating, bachelor's-degree-granting US schools (a few thousand, filtered
   down to the fields the site uses).
3. Reload the local server — the site now reflects live data.

## 3. Deploy for free

**GitHub Pages** (simplest, since you already have a GitHub account):

1. Push this folder to a GitHub repo.
2. Repo Settings → Pages → set source to the `main` branch, root folder.
3. Your site is live at `https://<username>.github.io/<repo-name>/` within a
   few minutes. No build step needed — it's plain HTML/CSS/JS.

Cloudflare Pages or Netlify work the same way if you'd rather use those —
both have permanent free tiers and deploy straight from a GitHub repo.

## 4. Keep data fresh automatically (optional but recommended)

The included GitHub Actions workflow re-runs the fetch script monthly and
commits the result, so you never have to do it by hand:

1. In your repo: Settings → Secrets and variables → Actions → New repository
   secret.
2. Name it `COLLEGE_SCORECARD_API_KEY`, paste your key as the value.
3. That's it — it runs on the 1st of each month, or you can trigger it
   manually from the Actions tab any time.

## 5. Extending to other countries later

The dataset shape (`data/schools.json`) is intentionally generic. To add a
country:

1. Create `data/schools-ca.json` (or `-au`, `-nl`) with the same field names,
   sourced from that country's open data (see note below — none of them have
   a single clean API like College Scorecard, so this step is more manual
   curation than a script).
2. Add a country toggle in the filter rack in `index.html`/`app.js` that
   swaps which JSON file `app.js` fetches.
3. Everything else — filtering, sorting, the shortlist, CSV export — keeps
   working unchanged.

## Top majors filter

Each school now lists its top 10 bachelor's-level majors, ranked by number of
graduates (the biggest, most established programs — not just anything
technically offered). These show as tags on each card and power the new
"Major" filter dropdown.

**If you re-run `fetch-data.js` and every school's majors list comes back
empty**, College Scorecard's nested program-data field names may not exactly
match what the script expects (this part of their API isn't fully
documented). To fix it:

1. Run the script and look at the console output — it prints a "Sample raw
   program data" block near the top showing the real field names for the
   first school.
2. Compare that to the field names used in `topBachelorsPrograms()` near the
   top of `scripts/fetch-data.js` (currently `title`, `credential.level`,
   `counts.ipeds_awards2`) and adjust them to match.
3. Re-run the script.

## Notes on the data

- Tuition, admission rate, grad rate, and earnings figures come from the
  College Scorecard API's `latest.*` fields — refer to their
  [data dictionary](https://collegescorecard.ed.gov/data/data-dictionary/)
  for exact definitions and known limitations (e.g. not every school reports
  every field every year).
- The sample data checked into this repo is a small, illustrative subset —
  replace it with a real pull (step 2) before sharing the site publicly.

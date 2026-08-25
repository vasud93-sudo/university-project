# US University Catalog — project log

This document tracks what the site is built from, what's been done so far,
and how to apply changes to the live GitHub repo. Keep it updated as the
project grows — it's the map for anyone (including future you) picking
this project back up later.

---

## 1. Data sources

### College Scorecard (primary dataset)
- **Publisher**: US Department of Education
- **Access point**: `api.data.gov/ed/collegescorecard/v1/schools`
- **Docs**: https://collegescorecard.ed.gov/data/api-documentation/
- **Key required**: yes, free, instant approval at https://api.data.gov/signup/
- **What it provides**: tuition, admission rate, enrollment, 4-year graduation
  rate, median earnings 10 years after entry, and — as of this project's
  major-filter feature — each school's top 10 bachelor's-level majors by
  number of graduates
- **Coverage**: ~1,944 currently-operating, bachelor's-degree-granting US
  institutions
- **License / terms**: public federal data, free to use and redistribute
- **Refresh cadence**: pulled live via `scripts/fetch-data.js`, automated
  monthly via GitHub Actions (`.github/workflows/refresh-data.yml`)

### CollegeData.FYI (planned — Common Data Set layer)
- **Publisher**: independent open-source project (MIT licensed)
- **Repo**: https://github.com/bolewood/collegedata-fyi
- **API docs**: https://www.collegedata.fyi/api
- **What it provides**: fields not in College Scorecard — SAT/ACT
  percentile ranges, Early Decision/Early Action policy, waitlist figures,
  admission-factor flags (legacy, first-gen, demonstrated interest), merit
  aid data — sourced from schools' own published Common Data Set (CDS)
  documents
- **Coverage**: ~699 of ~1,944 schools have CDS data archived (not all
  schools publish a CDS, and not every field is filled in by every school
  that does)
- **Access**: no signup or API key needed for the "simple endpoints"
  (`www.collegedata.fyi/api/...`); polite practice is to send an
  `X-CollegeData-Client` header identifying this project
- **License**: MIT (the aggregation/API); underlying CDS documents remain
  owned by each institution, reproduced under their public-document status
- **Status as of this log**: evaluated and confirmed working (tested live
  against MIT's data), not yet integrated into the site

### Why two sources instead of one
No single federal dataset covers both outcomes (Scorecard's strength) and
admissions-process detail like SAT ranges or ED/EA policy (CDS's
strength). The site is designed to keep these two sources clearly
separated in the data files and clearly labeled in the UI, so a user
always knows whether a number came from federal reporting or a school's
self-published CDS.

---

## 2. Site architecture

```
index.html              → main catalog grid page
style.css                → card-catalog visual theme
app.js                   → filtering, sorting, shortlist, CSV export
data/schools.json        → College Scorecard data (primary dataset)
scripts/fetch-data.js    → pulls schools.json from College Scorecard API
.github/workflows/refresh-data.yml → monthly automated data refresh
README.md                → setup and deployment instructions
```

Hosting: **GitHub Pages**, free tier, deployed from the `main` branch root.
No backend server — all filtering happens client-side in the browser
against the static JSON files.

---

## 3. Build log

| Date | What happened |
|---|---|
| Initial build | Site scaffolded: card-catalog UI, College Scorecard fetch script, shortlist + CSV export, GitHub Pages deployment |
| Follow-up | Added "top 10 bachelor's majors per school" feature and Major filter dropdown |
| Follow-up | Fixed a field-mapping bug in `fetch-data.js` — College Scorecard returns nested objects (`credential: { level: 3 }`), not flat dotted keys, for program data. Confirmed fix against real API response |
| Follow-up | Evaluated adding Common Data Set (CDS) data. Determined no automated path exists for CDS directly (it's published per-school as PDFs, no central API). Found and verified CollegeData.FYI as a working, MIT-licensed aggregator API instead |
| Planned | Add a per-school detail page: admission-strategy badges (ED/EA, waitlist, admission factors) and an interactive SAT/ACT "where you stand" comparator, both sourced from CollegeData.FYI |

---

## 4. How to apply changes on GitHub (reference steps)

These are the steps used throughout this project — reuse them for any
future update.

### Updating existing files
1. Go to the repo's **Code** tab
2. Click **Add file → Upload files**
3. Drag in the changed file(s) — GitHub matches by filename/path and
   offers to replace the existing version
4. Confirm the commit message and choose **Commit directly to the main
   branch**
5. Click **Commit changes**

### Adding a new file inside a folder (when drag-and-drop won't preserve
folder structure — notably `.github/workflows/` files)
1. **Code** tab → **Add file → Create new file**
2. Type the full path in the filename box, e.g. `data/cds.json` — the `/`
   auto-creates the folder
3. Paste the file contents into the editor box
4. Commit directly to `main`

### Re-running the data refresh workflow
1. **Actions** tab → select the workflow by name in the left sidebar
2. Click **Run workflow** → confirm
3. Wait for the green checkmark (usually under 2 minutes)
4. If it fails, click into the run → expand the failing step → check the
   log for the error

### Debugging a fetch script against a live API
When a data source's exact field names aren't fully documented, the
working pattern used in this project: add a one-time `console.log` of the
raw API response inside the fetch script, run it via the GitHub Actions
log output, compare the real field names against what the script assumes,
and patch the mismatch.

### Adding an API secret (e.g. an API key) for GitHub Actions
1. **Settings** tab → **Secrets and variables → Actions**
2. **New repository secret**
3. Name field: only letters, numbers, and underscores, no spaces —
   type it manually rather than pasting to avoid invisible whitespace
4. Value field: the actual key
5. Reference it in a workflow file as `${{ secrets.YOUR_SECRET_NAME }}`

---

## 5. Open items / next steps

- [ ] Build `scripts/fetch-cds-data.js` to pull CollegeData.FYI data for
      each school already in `data/schools.json`, save as `data/cds.json`
- [ ] Build a per-school detail page (new HTML file or client-side route)
- [ ] Add admission-strategy badges (ED/EA, waitlist, admission factors)
      — with explicit dark text color on all badges, confirmed readable
      against their light background
- [ ] Add the interactive SAT/ACT "where you stand" comparator
- [ ] Wire each grid card's "pull card" / school name to link into the
      new detail page
- [ ] Extend to Canada, Australia, Netherlands (see README.md §5 for the
      general approach — no single clean API exists for these yet, so
      this will require per-country data sourcing)

---

## 6. Engineering & educational review notes

A senior-engineer / educator review of the project (see chat log) surfaced
the following. Fixed items are checked; the rest are deliberate future work,
not urgent bugs.

### Fixed
- [x] XSS escaping — all data-sourced strings interpolated into HTML across
      `app.js` and `map.js` now go through an `escapeHtml()` helper.
      `school.js` was already safe (uses `.textContent` throughout).
- [x] International-student earnings-data caveat — visible on every school
      card (hover tooltip) and prominently on each school's detail page.
- [x] `methodology.html` — a dedicated page explaining what the data can and
      can't tell you, linked from the site footer.

### Deliberate future work, not fixed now
- **No automated tests.** Every bug caught in this project so far was found
  by manual clicking, not a test suite. Worth adding lightweight tests for
  pure functions (`initialsFor`, `bareDomain`, filter logic) before the
  codebase grows further.
- **No staging/preview step.** Every change goes straight to `main`. Fine at
  current scale; worth a "draft branch" habit if the project grows a team.
- **Third-party dependency risk.** The site depends on College Scorecard
  (stable, official), CollegeData.FYI (small independent project, could
  change or disappear), and logo.dev. If any of these change their API shape
  or shut down, the dependent feature will silently break until someone
  notices — there's no automated alerting for this today.
- **Major-specific earnings/debt data** — not pulled. Would require the much
  heavier "field of study" dataset (see README §"Top majors filter" for the
  Level 1 vs Level 2 discussion from earlier in the project).
- **No admissions-philosophy data** (need-blind/need-aware for
  international applicants specifically, holistic vs. stats-first review) —
  no structured data source exists for this; would require manual,
  per-school research, not automatable at current scale.

---

## 7. CDS coverage — known gap, deferred

Current state: 391 of 1,944 schools show real CDS-specific data
(`hasCdsData: true`), down from an inflated (buggy) 1,920/1,399 in earlier
runs. This is now an honest number, not a bug — but it's likely still an
undercount versus CollegeData.FYI's own ~699-school archive.

Likely causes, roughly ranked by suspected impact:
1. Name-matching still misses some real schools — College Scorecard's
   naming conventions don't always match CollegeData.FYI's search index,
   even with the fallback search (full name → stripped campus suffix →
   domain) added earlier.
2. Population mismatch — CollegeData.FYI's ~699-school archive may include
   schools outside this project's filter (2-year colleges, grad-only
   institutions, closed/merged schools) that would never appear in this
   site's 1,944-school list regardless of matching quality.
3. Unconfirmed: the 8-second request timeout + 8-way concurrency added for
   speed could occasionally cause a real match to fail under load — not
   verified, but can't be ruled out.
4. Unconfirmed: the domain-as-search-query fallback may not be as
   effective in practice as the name-based searches.

Decided: not worth chasing further right now. If it becomes a priority
later, the next step would be pulling the actual list of "no match found"
schools from a run's log and checking whether well-known, clearly-named
schools are among them (would confirm #1 is fixable) versus mostly obscure
institutions (would point to #2 as the bigger, less fixable factor).

---

## 8. Dataset scope — deliberate, not a bug

The site's ~1,944 schools are intentionally filtered to currently-operating
institutions where a bachelor's degree is the PREDOMINANT degree type
awarded (via `school.degrees_awarded.predominant=3` in
`scripts/fetch-data.js`). This is smaller than the full ~6,000+ degree-
granting postsecondary institutions in the US, because it excludes:
- 2-year community colleges (predominantly associate's degree)
- Graduate-only institutions (predominantly master's/doctoral)
- Schools where bachelor's exists but isn't the primary focus (e.g. a
  school that has grown mostly into a graduate institution)

Decided: keep this scope. It matches the site's actual purpose — helping
a prospective undergrad build a shortlist — better than including schools
that aren't realistic undergrad options.

If this ever needs revisiting: the filter could be loosened from
"predominantly bachelor's" to "offers bachelor's degrees at all" to catch
schools with real undergrad programs that aren't currently counted as
their main focus — worth reconsidering if users report a specific known
school missing that should reasonably be included.

---

## 9. Basis for Selection (CDS C7) — removed, data source doesn't have it

Attempted to add CDS Section C7 "Basis for Selection" (importance of GPA,
rigor, recommendations, legacy, demonstrated interest, etc. in admissions
decisions) based on an assumption that CollegeData.FYI encodes these as
fields prefixed "c7" + two digits (e.g. "c711_first_gen_factor").

This assumption was WRONG. Verified by dumping every single field
CollegeData.FYI returns for Harvard (a school with confirmed rich CDS
data) across both data sources available:
- `school_facts_unified` table: 62 fields, zero matches
- `/facts?categories=admissions` endpoint: 32 fields, zero matches

Root cause: the "c7XX" naming was likely a confusion between CDS's own
official item-numbering scheme (the form itself calls it "Item C7-11:
First generation") and CollegeData.FYI's actual internal field names,
which follow a completely different, plainer convention
(`ed_offered`, `sat_composite_p50`, etc.) — not verified before building
the feature.

**Lesson for future data additions**: verify a field actually exists by
checking real API output BEFORE building a feature around it, not after —
this one cost several debugging rounds that a single upfront check would
have caught immediately.

**Status**: feature fully removed (fetch script, detail-page section,
styling). Not worth re-attempting without a different, verified data
source for this specific content — no known free source has been found.

// Pulls the confirmed test-optional school list directly from FairTest
// (the National Center for Fair & Open Testing) — the source journalists
// and college counselors actually cite for this. Their public list page
// is JavaScript-rendered, but it's backed by a plain WordPress AJAX
// endpoint we can call directly (found via browser DevTools).
//
// This ONLY ever confirms "test-optional" — the endpoint returns schools
// FairTest has verified as test-optional/test-flexible/test-blind, not a
// full list with a status flag either way. A school not appearing here
// just means "not confirmed by this source" — it does NOT mean the school
// requires testing. That distinction matters: it's what keeps this script
// from ever repeating the earlier mistake of confidently asserting the
// wrong policy in either direction.
//
// Usage:
//   node scripts/fetch-fairtest-data.js
//
// This is a courtesy layer on top of scripts/fetch-cds-data.js — run that
// first. This script reads the existing data/cds.json and only ever
// upgrades a school's testOptional field to "confirmed" when FairTest
// backs it; it never overwrites with lower-confidence data.

const fs = require("fs");
const path = require("path");

const AJAX_URL = "https://fairtest.org/wp-admin/admin-ajax.php";
const CLIENT_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
  "User-Agent": "us-university-catalog (student project; contact via GitHub repo)",
};

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchPage(pageNum) {
  const body = new URLSearchParams({
    action: "filterschools",
    values: `posttype=school&schooltype=all&paged=${pageNum}&titleorder=asc&states=all`,
  });

  const res = await fetchWithTimeout(AJAX_URL, {
    method: "POST",
    headers: CLIENT_HEADERS,
    body: body.toString(),
  }).catch(() => null);

  if (!res || !res.ok) return { schools: [], maxPage: pageNum };

  const html = await res.text();

  const rowPattern = /<div class="row fpost[^"]*">\s*<div class="col-sm-7 posttitle">\s*<a href="[^"]*" title="([^"]*)">[^<]*<\/a>\s*<\/div>\s*<div class="col-sm-3 postsubject">([^<]*)<\/div>\s*<div class="col-sm-2 issuedate">([^<]*)<\/div>\s*<\/div>/g;

  const schools = [];
  let match;
  while ((match = rowPattern.exec(html)) !== null) {
    schools.push({
      name: decodeEntities(match[1].trim()),
      city: decodeEntities(match[2].trim()),
      state: decodeEntities(match[3].trim()),
    });
  }

  // The pagination control block includes every page number as a
  // data-val attribute — the highest one tells us the total page count,
  // straight from page 1's response, no separate lookup needed.
  const pageNumbers = [...html.matchAll(/data-val="(\d+)"/g)].map((m) => Number(m[1]));
  const maxPage = pageNumbers.length > 0 ? Math.max(...pageNumbers) : pageNum;

  return { schools, maxPage };
}

// Same fallback-matching approach used for CollegeData.FYI: try the exact
// name first, then a version with a trailing "-Something" campus suffix
// stripped, since College Scorecard's naming often differs slightly from
// how other sites list the same school.
function buildLookupSet(fairtestSchools) {
  const set = new Set();
  for (const s of fairtestSchools) {
    set.add(s.name.toLowerCase().trim());
  }
  return set;
}

function isConfirmedTestOptional(schoolName, lookupSet) {
  const name = schoolName.toLowerCase().trim();
  if (lookupSet.has(name)) return true;
  const stripped = name.replace(/-[^-]+$/, "").trim();
  if (stripped !== name && lookupSet.has(stripped)) return true;
  return false;
}

async function main() {
  console.log("Fetching confirmed test-optional list from FairTest...");

  let allSchools = [];
  const first = await fetchPage(1);
  allSchools = allSchools.concat(first.schools);
  console.log(`  page 1/${first.maxPage}: ${first.schools.length} schools`);

  for (let page = 2; page <= first.maxPage; page++) {
    const { schools } = await fetchPage(page);
    allSchools = allSchools.concat(schools);
    console.log(`  page ${page}/${first.maxPage}: ${schools.length} schools (${allSchools.length} total so far)`);
    // Be a polite, low-volume client — this is a small nonprofit's site,
    // not a commercial API built for bulk automated access.
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nFetched ${allSchools.length} confirmed test-optional schools from FairTest.`);

  const lookupSet = buildLookupSet(allSchools);

  const schoolsPath = path.join(__dirname, "..", "data", "schools.json");
  const cdsPath = path.join(__dirname, "..", "data", "cds.json");
  const schools = JSON.parse(fs.readFileSync(schoolsPath, "utf8"));
  const cds = JSON.parse(fs.readFileSync(cdsPath, "utf8"));

  let upgraded = 0;
  for (const school of schools) {
    if (isConfirmedTestOptional(school.name, lookupSet)) {
      const existing = cds[school.id] || { id: school.id, name: school.name, hasCdsData: false, hasAnyData: false };
      existing.testOptional = { status: "optional", confidence: "confirmed", source: "FairTest" };
      existing.hasAnyData = true;
      cds[school.id] = existing;
      upgraded++;
    }
  }

  fs.writeFileSync(cdsPath, JSON.stringify(cds, null, 2));
  console.log(`Upgraded ${upgraded} schools to FairTest-confirmed test-optional status.`);
  console.log(`Saved to ${cdsPath}`);
}

main().catch((err) => {
  console.error("FairTest fetch failed:", err.message);
  process.exit(1);
});

// Pulls Common Data Set (CDS) admission-strategy and test-score data from
// CollegeData.FYI for every school already in data/schools.json, and saves
// the result as data/cds.json, keyed by the same school id used there.
//
// No API key needed — CollegeData.FYI's "simple endpoints" are open.
// Docs: https://www.collegedata.fyi/api
//
// Usage:
//   node scripts/fetch-cds-data.js

const fs = require("fs");
const path = require("path");

const API_BASE = "https://www.collegedata.fyi/api";
const RAW_API_BASE = "https://api.collegedata.fyi/rest/v1";
// Public, read-only key published in CollegeData.FYI's own API docs —
// safe to embed, grants no write access.
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzZHV3bXlndm1kb3pocHZ6YWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDk3NTksImV4cCI6MjA5MTY4NTc1OX0.fYZOIHyrOWzidgc-CVxWCY5Fe9pQk12-6YjDIS6y9qs";
const RAW_HEADERS = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };
// Polite practice per their docs: identify this project in requests.
const CLIENT_HEADER = { "X-CollegeData-Client": "us-university-catalog" };

// College Scorecard names often carry campus suffixes (e.g. "-Main Campus",
// "-Ann Arbor") that don't match how CollegeData.FYI indexes school names,
// silently breaking the search. This tries several increasingly-simplified
// queries until one returns a result, instead of giving up after one try.
function searchQueryCandidates(schoolName, domain) {
  const candidates = [schoolName];

  // Strip a trailing "-Something" campus/location qualifier.
  const stripped = schoolName.replace(/-[^-]+$/, "").trim();
  if (stripped && stripped !== schoolName) candidates.push(stripped);

  // Domain is unambiguous and often indexed even when name text isn't.
  if (domain) candidates.push(domain);

  return [...new Set(candidates)];
}

async function trySearch(query) {
  const url = `${API_BASE}/schools/search?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: CLIENT_HEADER });
  if (!res.ok) return null;
  const data = await res.json();
  const results = data.results || data.schools || data;
  if (!Array.isArray(results) || results.length === 0) return null;
  return results[0].school_id || results[0].slug || results[0].id || null;
}

async function findSlug(schoolName, domain) {
  for (const query of searchQueryCandidates(schoolName, domain)) {
    const slug = await trySearch(query);
    if (slug) return slug;
  }
  return null;
}

async function fetchFacts(slug) {
  const url = `${API_BASE}/schools/${slug}/facts?categories=admissions`;
  const res = await fetch(url, { headers: CLIENT_HEADER });
  if (!res.ok) return null;
  return res.json();
}

// Pulls a fact's value out of the /facts response by key, respecting the
// quality flag — returns null if CollegeData.FYI marked it unavailable,
// rather than a possibly-stale or misleading number.
function factValue(facts, key) {
  const fact = (facts.facts || []).find((f) => f.key === key);
  if (!fact || fact.value === null || fact.value === undefined) return null;
  return fact.value;
}

// Merit (non-need-based) aid data — from the raw school_merit_profile
// table, since the friendly /facts endpoint doesn't expose it.
async function fetchMeritAid(slug) {
  const url = `${RAW_API_BASE}/school_merit_profile?school_id=eq.${slug}&select=first_year_ft_students,non_need_aid_recipients_first_year_ft,avg_non_need_grant_first_year_ft,non_need_aid_share_first_year_ft`;
  const res = await fetch(url, { headers: RAW_HEADERS });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] || null;
}

// International (nonresident-alien, the federal IPEDS category) enrollment
// share. The exact field_key isn't confirmed ahead of time, so instead of
// guessing one key, we pull every fact for the school and search by label
// text — more resilient to naming differences, and logs what it found (or
// didn't) so a mismatch is easy to diagnose from the Action run log.
async function fetchInternationalShare(slug, logSample) {
  const url = `${RAW_API_BASE}/school_facts_unified?school_id=eq.${slug}&select=field_key,field_label,display_value,value_numeric,unit`;
  const res = await fetch(url, { headers: RAW_HEADERS });
  if (!res.ok) return null;
  const rows = await res.json();

  if (logSample) {
    console.log(
      "\nSample school_facts_unified rows (for verifying international field name):\n",
      JSON.stringify(rows.slice(0, 5), null, 2).slice(0, 800),
      "\n"
    );
  }

  const match = rows.find((r) =>
    /international|nonresident/i.test(r.field_label || "") || /international|nonresident/i.test(r.field_key || "")
  );
  if (!match) return null;
  return { value: match.value_numeric, label: match.field_label, fieldKey: match.field_key };
}

function normalize(schoolId, schoolName, facts, meritAid, international) {
  if (!facts) {
    return { id: schoolId, name: schoolName, hasCdsData: false };
  }

  // SAT composite isn't always reported directly; where it's missing, we
  // approximate the 25th/75th percentile range by summing the two section
  // scores (EBRW + Math), which College Scorecard's IPEDS layer reports
  // even when the school's own CDS didn't give a composite figure.
  const satEbrw25 = factValue(facts, "ipeds.sat_ebrw_p25");
  const satEbrw75 = factValue(facts, "ipeds.sat_ebrw_p75");
  const satMath25 = factValue(facts, "ipeds.sat_math_p25");
  const satMath75 = factValue(facts, "ipeds.sat_math_p75");

  return {
    id: schoolId,
    name: schoolName,
    hasCdsData: true,
    satComposite50: factValue(facts, "sat_composite_p50"),
    satComposite25: satEbrw25 != null && satMath25 != null ? satEbrw25 + satMath25 : null,
    satComposite75: satEbrw75 != null && satMath75 != null ? satEbrw75 + satMath75 : null,
    actComposite25: factValue(facts, "ipeds.act_composite_p25"),
    actComposite50: factValue(facts, "ipeds.act_composite_p50") ?? factValue(facts, "act_composite_p50"),
    actComposite75: factValue(facts, "ipeds.act_composite_p75"),
    edOffered: factValue(facts, "ed_offered"),
    eaOffered: factValue(facts, "ea_offered"),
    waitlistOffered: factValue(facts, "wait_list_offered"),
    sourceName: "school-published Common Data Set",
    meritAid: meritAid && meritAid.first_year_ft_students
      ? {
          recipientShare: meritAid.non_need_aid_share_first_year_ft,
          avgAward: meritAid.avg_non_need_grant_first_year_ft,
        }
      : null,
    internationalEnrollmentPct: international ? international.value : null,
  };
}

async function main() {
  const schoolsPath = path.join(__dirname, "..", "data", "schools.json");
  const schools = JSON.parse(fs.readFileSync(schoolsPath, "utf8"));
  const cdsData = {};

  console.log(`Fetching CDS data for ${schools.length} schools from CollegeData.FYI...`);
  let loggedInternationalSample = false;

  for (let i = 0; i < schools.length; i++) {
    const school = schools[i];
    try {
      const slug = await findSlug(school.name, school.url);
      if (!slug) {
        cdsData[school.id] = { id: school.id, name: school.name, hasCdsData: false };
        console.log(`  ${i + 1}/${schools.length}: ${school.name} — no match found`);
        continue;
      }
      const facts = await fetchFacts(slug);
      const meritAid = await fetchMeritAid(slug).catch(() => null);
      const international = await fetchInternationalShare(slug, !loggedInternationalSample).catch(() => null);
      loggedInternationalSample = true;

      cdsData[school.id] = normalize(school.id, school.name, facts, meritAid, international);
      console.log(`  ${i + 1}/${schools.length}: ${school.name} — matched "${slug}"`);
    } catch (err) {
      cdsData[school.id] = { id: school.id, name: school.name, hasCdsData: false };
      console.log(`  ${i + 1}/${schools.length}: ${school.name} — error: ${err.message}`);
    }
    // Be a polite API citizen — small pause between requests.
    await new Promise((r) => setTimeout(r, 120));
  }

  const outPath = path.join(__dirname, "..", "data", "cds.json");
  fs.writeFileSync(outPath, JSON.stringify(cdsData, null, 2));
  const matched = Object.values(cdsData).filter((s) => s.hasCdsData).length;
  console.log(`\nSaved CDS data for ${matched}/${schools.length} schools to ${outPath}`);
}

main().catch((err) => {
  console.error("CDS fetch failed:", err.message);
  process.exit(1);
});

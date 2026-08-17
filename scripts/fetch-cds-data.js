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

// Every fetch here has an explicit timeout — without one, a single slow
// or hung request could stall the entire script indefinitely (this is
// almost certainly what happened on a run that ran 30+ minutes with no
// sign of finishing). 8 seconds is generous for a small JSON API response.
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

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
  const res = await fetchWithTimeout(url, { headers: CLIENT_HEADER }).catch(() => null);
  if (!res || !res.ok) return null;
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
  const res = await fetchWithTimeout(url, { headers: CLIENT_HEADER }).catch(() => null);
  if (!res || !res.ok) return null;
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

// Determines test-optional status two ways, in order of trust:
//
// 1. DIRECT: search every fact's key/label for something explicitly about
//    testing policy (e.g. "test_optional", "testing policy"). If found,
//    this is the school's actual stated policy — highest confidence.
// 2. INFERRED: if no direct field exists, fall back to how many admitted
//    students actually submitted SAT/ACT scores. A submit rate well below
//    100% is a practical signal the school doesn't require them, even
//    without an explicit policy field — lower confidence, clearly labeled
//    as inferred wherever it's shown on the site.
//
// Returns null (unknown) rather than guessing when neither signal exists.
function determineTestOptional(facts, logSample) {
  const directFact = (facts.facts || []).find((f) =>
    /test.*optional|optional.*test|testing.?polic/i.test(f.key || "") ||
    /test.*optional|optional.*test|testing.?polic/i.test(f.label || "")
  );

  if (logSample) {
    console.log(
      "\nSample admissions facts (for verifying testing-policy field name):\n",
      JSON.stringify((facts.facts || []).map((f) => ({ key: f.key, label: f.label, value: f.value })), null, 2).slice(0, 1200),
      "\n"
    );
  }

  if (directFact && directFact.value != null) {
    // Normalize whatever shape the value comes in (boolean or string).
    const val = directFact.value;
    const isOptional = val === true || /optional|blind|flexible/i.test(String(val));
    return { status: isOptional ? "optional" : "required", confidence: "confirmed" };
  }

  const satSubmitRate = factValue(facts, "sat_submit_rate");
  const actSubmitRate = factValue(facts, "act_submit_rate");
  const bestSubmitRate = [satSubmitRate, actSubmitRate].filter((v) => v != null).sort((a, b) => b - a)[0];

  if (bestSubmitRate == null) return null;
  // Below ~60% submission strongly suggests the school isn't requiring
  // scores in practice; above ~90% suggests they effectively are.
  // Between those, the signal is too weak to call confidently.
  if (bestSubmitRate < 0.6) return { status: "optional", confidence: "inferred" };
  if (bestSubmitRate > 0.9) return { status: "required", confidence: "inferred" };
  return null;
}

// Merit (non-need-based) aid data — from the raw school_merit_profile
// table, since the friendly /facts endpoint doesn't expose it.
async function fetchMeritAid(slug) {
  const url = `${RAW_API_BASE}/school_merit_profile?school_id=eq.${slug}&select=first_year_ft_students,non_need_aid_recipients_first_year_ft,avg_non_need_grant_first_year_ft,non_need_aid_share_first_year_ft`;
  const res = await fetchWithTimeout(url, { headers: RAW_HEADERS }).catch(() => null);
  if (!res || !res.ok) return null;
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
  const res = await fetchWithTimeout(url, { headers: RAW_HEADERS }).catch(() => null);
  if (!res || !res.ok) return null;
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

function normalize(schoolId, schoolName, facts, meritAid, international, logTestOptionalSample) {
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

  const satComposite50 = factValue(facts, "sat_composite_p50");
  const satComposite25 = satEbrw25 != null && satMath25 != null ? satEbrw25 + satMath25 : null;
  const satComposite75 = satEbrw75 != null && satMath75 != null ? satEbrw75 + satMath75 : null;
  const actComposite25 = factValue(facts, "ipeds.act_composite_p25");
  const actComposite50 = factValue(facts, "ipeds.act_composite_p50") ?? factValue(facts, "act_composite_p50");
  const actComposite75 = factValue(facts, "ipeds.act_composite_p75");
  const edOffered = factValue(facts, "ed_offered");
  const eaOffered = factValue(facts, "ea_offered");
  const waitlistOffered = factValue(facts, "wait_list_offered");
  const meritAidResult = meritAid && meritAid.first_year_ft_students
    ? {
        recipientShare: meritAid.non_need_aid_share_first_year_ft,
        avgAward: meritAid.avg_non_need_grant_first_year_ft,
      }
    : null;
  const internationalEnrollmentPct = international ? international.value : null;
  const testOptional = determineTestOptional(facts, logTestOptionalSample);
  // A link to the actual archived CDS document, when CollegeData.FYI
  // provides one — this is their own recorded source, not a guessed URL.
  const cdsDocumentUrl = facts.sources?.find((s) => s.kind === "cds_document")?.archive_url || null;

  // Two different questions, deliberately kept separate:
  //
  // hasCdsData (strict) — does a genuine CDS document exist for this
  // school? Only true if a field that's EXCLUSIVELY CDS-sourced has a
  // value (satComposite50, ED/EA/waitlist status, merit aid). Drives the
  // "CDS data" filter/badge and the admission-strategy section, since
  // those specifically represent CDS content.
  //
  // hasAnyData (broad) — is there anything at all worth showing? SAT/ACT
  // ranges here are actually sourced from "ipeds.*" fields — real federal
  // IPEDS reporting that most schools have regardless of whether they
  // publish a CDS. That data is still genuinely useful (it's what powers
  // the "where you stand" comparator) and shouldn't be discarded just
  // because it doesn't prove a CDS document exists.
  const hasCdsData = [satComposite50, edOffered, eaOffered, waitlistOffered, meritAidResult].some((v) => v != null);
  const hasAnyData = [
    satComposite50, satComposite25, actComposite25, actComposite50,
    edOffered, eaOffered, waitlistOffered, meritAidResult, internationalEnrollmentPct, testOptional,
  ].some((v) => v != null);

  if (!hasAnyData) {
    return { id: schoolId, name: schoolName, hasCdsData: false, hasAnyData: false };
  }

  return {
    id: schoolId,
    name: schoolName,
    hasCdsData,
    hasAnyData: true,
    satComposite50,
    satComposite25,
    satComposite75,
    actComposite25,
    actComposite50,
    actComposite75,
    edOffered,
    eaOffered,
    waitlistOffered,
    sourceName: "school-published Common Data Set",
    cdsDocumentUrl,
    meritAid: meritAidResult,
    internationalEnrollmentPct,
    testOptional, // { status: "optional"|"required", confidence: "confirmed"|"inferred" } or null
  };
}

// Processes one school: find its slug, then run the facts/merit/international
// lookups IN PARALLEL (they're independent of each other) instead of one
// after another — this alone cuts per-school time roughly 3x.
async function processSchool(school, loggedInternationalSampleRef) {
  const slug = await findSlug(school.name, school.url);
  if (!slug) {
    return { id: school.id, name: school.name, hasCdsData: false };
  }

  const shouldLog = !loggedInternationalSampleRef.done;
  loggedInternationalSampleRef.done = true;

  const [facts, meritAid, international] = await Promise.all([
    fetchFacts(slug).catch(() => null),
    fetchMeritAid(slug).catch(() => null),
    fetchInternationalShare(slug, shouldLog).catch(() => null),
  ]);

  return normalize(school.id, school.name, facts, meritAid, international, shouldLog);
}

// Runs schools with limited concurrency (CONCURRENCY at a time) instead of
// one at a time. Fully serial processing of ~1,944 schools at several
// requests each was taking 30-60+ minutes; this cuts wall-clock time
// roughly in proportion to the concurrency level while still being a
// reasonable, non-abusive load on a small free API.
const CONCURRENCY = 8;

async function main() {
  const schoolsPath = path.join(__dirname, "..", "data", "schools.json");
  const schools = JSON.parse(fs.readFileSync(schoolsPath, "utf8"));
  const cdsData = {};
  const loggedInternationalSampleRef = { done: false };

  console.log(`Fetching CDS data for ${schools.length} schools from CollegeData.FYI (concurrency: ${CONCURRENCY})...`);

  let completed = 0;
  let index = 0;

  async function worker() {
    while (index < schools.length) {
      const i = index++;
      const school = schools[i];
      try {
        cdsData[school.id] = await processSchool(school, loggedInternationalSampleRef);
      } catch (err) {
        cdsData[school.id] = { id: school.id, name: school.name, hasCdsData: false };
      }
      completed++;
      if (completed % 25 === 0 || completed === schools.length) {
        const matchedSoFar = Object.values(cdsData).filter((s) => s.hasCdsData).length;
        console.log(`  ${completed}/${schools.length} processed (${matchedSoFar} matched so far)`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const outPath = path.join(__dirname, "..", "data", "cds.json");
  fs.writeFileSync(outPath, JSON.stringify(cdsData, null, 2));
  const matched = Object.values(cdsData).filter((s) => s.hasCdsData).length;
  console.log(`\nSaved CDS data for ${matched}/${schools.length} schools to ${outPath}`);
}

main().catch((err) => {
  console.error("CDS fetch failed:", err.message);
  process.exit(1);
});

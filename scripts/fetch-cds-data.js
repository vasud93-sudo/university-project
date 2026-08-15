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
// Polite practice per their docs: identify this project in requests.
const CLIENT_HEADER = { "X-CollegeData-Client": "us-university-catalog" };

async function findSlug(schoolName) {
  const url = `${API_BASE}/schools/search?q=${encodeURIComponent(schoolName)}`;
  const res = await fetch(url, { headers: CLIENT_HEADER });
  if (!res.ok) return null;
  const data = await res.json();
  const results = data.results || data.schools || data;
  if (!Array.isArray(results) || results.length === 0) return null;
  return results[0].school_id || results[0].slug || results[0].id || null;
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

function normalize(schoolId, schoolName, facts) {
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
    sourceUrl: facts.sources?.find((s) => s.kind === "cds_document")?.archive_url || null,
  };
}

async function main() {
  const schoolsPath = path.join(__dirname, "..", "data", "schools.json");
  const schools = JSON.parse(fs.readFileSync(schoolsPath, "utf8"));
  const cdsData = {};

  console.log(`Fetching CDS data for ${schools.length} schools from CollegeData.FYI...`);

  for (let i = 0; i < schools.length; i++) {
    const school = schools[i];
    try {
      const slug = await findSlug(school.name);
      if (!slug) {
        cdsData[school.id] = { id: school.id, name: school.name, hasCdsData: false };
        console.log(`  ${i + 1}/${schools.length}: ${school.name} — no match found`);
        continue;
      }
      const facts = await fetchFacts(slug);
      cdsData[school.id] = normalize(school.id, school.name, facts);
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

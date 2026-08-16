// Pulls US university data from the College Scorecard API and writes a
// trimmed, filter-ready JSON file to /data/schools.json.
//
// Usage:
//   COLLEGE_SCORECARD_API_KEY=your_key_here node scripts/fetch-data.js
//
// Get a free key at https://api.data.gov/signup/  (approved instantly)
// Docs: https://collegescorecard.ed.gov/data/api-documentation/

const fs = require("fs");
const path = require("path");

const API_KEY = process.env.COLLEGE_SCORECARD_API_KEY || "DEMO_KEY";
const BASE_URL = "https://api.data.gov/ed/collegescorecard/v1/schools";

// Only the fields the site's filters/cards actually use.
// Add more here any time — just remember to update app.js to display them.
const FIELDS = [
  "id",
  "school.name",
  "school.city",
  "school.state",
  "school.school_url",
  "school.ownership", // 1=public, 2=private nonprofit, 3=private for-profit
  "location.lat",
  "location.lon",
  "latest.cost.tuition.in_state",
  "latest.cost.tuition.out_of_state",
  "latest.admissions.admission_rate.overall",
  "latest.student.size",
  "latest.completion.completion_rate_4yr_150nt",
  "latest.earnings.10_yrs_after_entry.median",
  // Nested field-of-study data: one entry per major offered at the school.
  // all_programs_nested=true (added below) returns every program, not just
  // ones matching a filter — we need the full list to rank them ourselves.
  "latest.programs.cip_4_digit.title",
  "latest.programs.cip_4_digit.code",
  "latest.programs.cip_4_digit.credential.level",
  "latest.programs.cip_4_digit.counts.ipeds_awards2",
].join(",");

// Credential level 3 = Bachelor's degree, per College Scorecard's glossary
// (1=undergrad certificate, 2=associate's, 3=bachelor's, 4+=grad-level).
const BACHELORS_CREDENTIAL_LEVEL = 3;
const TOP_PROGRAMS_PER_SCHOOL = 10;

// Keep the dataset to currently-operating, degree-granting 4-year schools
// so the filtered list stays useful instead of huge.
const FILTERS = [
  "school.operating=1",
  "school.degrees_awarded.predominant=3", // predominantly bachelor's-degree granting
].join("&");

const PER_PAGE = 100;

async function fetchPage(page) {
  const url = `${BASE_URL}?api_key=${API_KEY}&fields=${FIELDS}&${FILTERS}&per_page=${PER_PAGE}&page=${page}&all_programs_nested=true`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

// The four CIP 2-digit families DHS designates as core STEM by law, no
// exceptions — 8 CFR 214.2(f)(10)(ii)(C)(2). Any major whose CIP code
// starts with one of these prefixes is reliably STEM OPT eligible.
// DHS also approves specific individual majors from 18 OTHER subject
// areas (e.g. Computer Science under CIP 11) — but only at the exact
// 6-digit code level, not the whole family. We deliberately don't try to
// replicate that longer, more error-prone list here: getting a visa-
// consequential classification wrong is worse than saying "check the
// official list" for anything outside the four reliable core families.
const CORE_STEM_CIP_PREFIXES = ["14", "26", "27", "40"];
function isCoreStem(cipCode) {
  if (!cipCode) return false;
  // Real API format confirmed via debug log: a bare 4-digit string like
  // "0109" (CIP family "01", sub-family "09") — NOT "14.1901" as
  // originally assumed. The first 2 characters are the CIP family code
  // regardless of whether a dot is present, so strip any dot first and
  // take the first 2 digits either way — safe for both formats.
  const digits = String(cipCode).replace(".", "");
  const prefix = digits.slice(0, 2).padStart(2, "0");
  return CORE_STEM_CIP_PREFIXES.includes(prefix);
}

// Picks the school's top N bachelor's-level majors by number of graduates.
// If the nested program data comes back empty or in an unexpected shape,
// this safely returns [] instead of crashing the whole fetch — see the
// troubleshooting note in README.md if that happens.
function topBachelorsPrograms(rawPrograms) {
  if (!Array.isArray(rawPrograms)) return [];

  return rawPrograms
    .filter((p) => p && p.credential?.level === BACHELORS_CREDENTIAL_LEVEL && p.title)
    .sort((a, b) => (b.counts?.ipeds_awards2 ?? 0) - (a.counts?.ipeds_awards2 ?? 0))
    .slice(0, TOP_PROGRAMS_PER_SCHOOL)
    .map((p) => ({
      title: p.title.replace(/\.$/, ""), // strip trailing period, e.g. "Animal Sciences."
      cipCode: p.code ?? null,
      coreStem: isCoreStem(p.code),
    }));
}

function ownershipLabel(code) {
  return { 1: "Public", 2: "Private nonprofit", 3: "Private for-profit" }[code] || "Unknown";
}

function normalize(raw) {
  return {
    id: raw.id,
    name: raw["school.name"],
    city: raw["school.city"],
    state: raw["school.state"],
    url: raw["school.school_url"],
    ownership: ownershipLabel(raw["school.ownership"]),
    lat: raw["location.lat"],
    lon: raw["location.lon"],
    tuitionInState: raw["latest.cost.tuition.in_state"],
    tuitionOutOfState: raw["latest.cost.tuition.out_of_state"],
    admissionRate: raw["latest.admissions.admission_rate.overall"],
    enrollment: raw["latest.student.size"],
    gradRate4yr: raw["latest.completion.completion_rate_4yr_150nt"],
    medianEarnings10yr: raw["latest.earnings.10_yrs_after_entry.median"],
    topPrograms: topBachelorsPrograms(raw["latest.programs.cip_4_digit"]),
  };
}

async function main() {
  console.log(`Fetching College Scorecard data (key: ${API_KEY === "DEMO_KEY" ? "DEMO_KEY — low rate limit, get your own for a full run" : "custom key"})...`);

  let page = 0;
  let total = Infinity;
  const results = [];
  let loggedSampleProgram = false;

  while (results.length < total) {
    const data = await fetchPage(page);
    total = data.metadata.total;

    // One-time sanity check: print the raw shape of the first school's
    // program data so you can confirm the field names below are correct.
    // If topPrograms end up empty for every school, compare this printout
    // against the field names used in topBachelorsPrograms() above and
    // adjust them to match (College Scorecard's nested field names have
    // shifted before between API versions).
    if (!loggedSampleProgram && data.results[0]) {
      console.log(
        "\nSample raw program data (for verifying field names):\n",
        JSON.stringify(data.results[0]["latest.programs.cip_4_digit"], null, 2).slice(0, 800),
        "\n"
      );
      loggedSampleProgram = true;
    }

    results.push(...data.results.map(normalize));
    console.log(`  page ${page + 1}: ${results.length}/${total} schools`);
    page += 1;

    // api.data.gov hourly limit is generous, but a short pause is polite.
    await new Promise((r) => setTimeout(r, 150));
  }

  const outPath = path.join(__dirname, "..", "data", "schools.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nSaved ${results.length} schools to ${outPath}`);
}

main().catch((err) => {
  console.error("Fetch failed:", err.message);
  process.exit(1);
});

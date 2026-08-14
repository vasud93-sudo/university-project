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
  "latest.cost.tuition.in_state",
  "latest.cost.tuition.out_of_state",
  "latest.admissions.admission_rate.overall",
  "latest.student.size",
  "latest.completion.completion_rate_4yr_150nt",
  "latest.earnings.10_yrs_after_entry.median",
  "latest.programs.cip_4_digit", // used to derive rough program/major tags
].join(",");

// Keep the dataset to currently-operating, degree-granting 4-year schools
// so the filtered list stays useful instead of huge.
const FILTERS = [
  "school.operating=1",
  "school.degrees_awarded.predominant=3", // predominantly bachelor's-degree granting
].join("&");

const PER_PAGE = 100;

async function fetchPage(page) {
  const url = `${BASE_URL}?api_key=${API_KEY}&fields=${FIELDS}&${FILTERS}&per_page=${PER_PAGE}&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
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
    tuitionInState: raw["latest.cost.tuition.in_state"],
    tuitionOutOfState: raw["latest.cost.tuition.out_of_state"],
    admissionRate: raw["latest.admissions.admission_rate.overall"],
    enrollment: raw["latest.student.size"],
    gradRate4yr: raw["latest.completion.completion_rate_4yr_150nt"],
    medianEarnings10yr: raw["latest.earnings.10_yrs_after_entry.median"],
    programCodes: raw["latest.programs.cip_4_digit"]
      ? raw["latest.programs.cip_4_digit"].map((p) => p.code)
      : [],
  };
}

async function main() {
  console.log(`Fetching College Scorecard data (key: ${API_KEY === "DEMO_KEY" ? "DEMO_KEY — low rate limit, get your own for a full run" : "custom key"})...`);

  let page = 0;
  let total = Infinity;
  const results = [];

  while (results.length < total) {
    const data = await fetchPage(page);
    total = data.metadata.total;
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

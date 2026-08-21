// Pulls Bachelor's-level scholarships from EducationUSA
// (educationusa.state.gov) — the US Department of State's own official
// resource for international students. This is the highest-authenticity
// source used anywhere in this project: a real .gov domain, not a
// third-party aggregator.
//
// Scope: Bachelor's degree level only (field_scholarship_degree_levels_tid=16
// — confirmed against the live site's own filter, which marked this exact
// value as "Undergraduate - Bachelor's").
//
// IMPORTANT CAVEAT: unlike our other fetch scripts, this one was built
// without ever seeing the site's raw HTML source — only an auto-converted
// text rendering of it. The parsing logic here is a best-effort guess at
// the real markup, using known, directly-observed LABEL TEXT (e.g.
// "Location", "Scholarship Deadline") rather than guessed CSS class names,
// since label text is far more likely to survive unchanged than internal
// class names. Still, treat this as needing one debug-and-fix pass once
// run for real — same as almost every other source in this project.
//
// Usage:
//   node scripts/fetch-scholarships-data.js

const fs = require("fs");
const path = require("path");

const BASE_URL = "https://educationusa.state.gov";
const LISTING_URL = `${BASE_URL}/find-financial-aid`;
const BACHELORS_DEGREE_LEVEL_TID = 16; // confirmed against the live site's own filter
const RESULTS_PER_PAGE = 10; // observed from the site's own "Showing X - Y" text
const CLIENT_HEADERS = {
  "User-Agent": "us-university-catalog (student project; free scholarship listing for international students)",
};

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal, headers: CLIENT_HEADERS });
  } finally {
    clearTimeout(timeout);
  }
}

// This site occasionally responds slowly enough to trip even a generous
// timeout (confirmed live: a real run hit "This operation was aborted" on
// page 0 despite an earlier run succeeding fine) — a single retry after a
// short pause is cheap insurance against one slow response killing the
// whole run.
async function fetchWithRetry(url, options = {}, timeoutMs = 20000) {
  try {
    return await fetchWithTimeout(url, options, timeoutMs);
  } catch (err) {
    await new Promise((r) => setTimeout(r, 2000));
    return fetchWithTimeout(url, options, timeoutMs);
  }
}

// Converts raw HTML to plain text while preserving line breaks at block
// element boundaries — critical so "Location" and "Albania" don't get
// concatenated into "LocationAlbania" once tags are stripped.
function decodeEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<(br|\/div|\/p|\/li|\/h[1-6]|\/tr)\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]*\n+/g, "\n")
    .trim();
}

// Finds every scholarship link + category tag on one listing page. Titles
// on this site link to paths like /scholarships/some-slug or /node/1234 —
// this pattern is unlikely to change even if visual markup does.
function parseListingPage(html) {
  const results = [];
  // Only match real /scholarships/slug URLs — the generic /node/123
  // pattern was also matching non-scholarship utility pages (confirmed
  // real: "Error/Bug Submission Form" got scraped as a fake "scholarship"
  // on a live run). Every real scholarship we've seen consistently uses
  // the /scholarships/ path, so dropping /node/ loses nothing real.
  const linkPattern = /<a[^>]+href="((?:https:\/\/educationusa\.state\.gov)?\/scholarships\/[a-z0-9-]+)"[^>]*>([^<]+)<\/a>/gi;
  let match;
  const seen = new Set();
  while ((match = linkPattern.exec(html)) !== null) {
    const url = match[1].startsWith("http") ? match[1] : BASE_URL + match[1];
    // Decode entities here — the detail page's text also gets decoded
    // (via htmlToText), so an undecoded title like "President&#039;s..."
    // would never match its own decoded page text later. This was
    // silently breaking sponsoringOrg extraction for every title with an
    // apostrophe, ampersand, or similar character (confirmed: 100/134
    // came back null on a real run, while simple titles worked fine).
    const title = decodeEntities(match[2].trim());
    // Skip nav/footer links that happen to match the URL pattern but
    // aren't real scholarship titles (e.g. "Read more", empty text).
    if (!title || title.length < 4 || /^read more$/i.test(title)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    results.push({ url, title });
  }
  return results;
}

// Known field labels, plus a universal terminator: "Search form" reliably
// marks the exact boundary where every page's shared footer boilerplate
// begins (confirmed identical across all 5 real pages checked). Without
// this, extraction ran straight into "Our Goal... Privacy Notice... FAQs"
// on any field with nothing else after it — the actual bug we hit.
const DETAIL_LABELS = [
  "Location",
  "Scholarship Deadline",
  "Scholarship deadline same as application deadline",
  "Scholarship deadline different from application deadline",
  "Degree levels",
  "Duration of Award",
  "Maximum amount of award",
  "Restricted to these majors",
  "Majors",
  "Search form", // universal terminator — always present, always after real content
];

function extractField(text, label, allLabels) {
  const idx = text.indexOf(label);
  if (idx === -1) return null;
  const after = text.slice(idx + label.length);
  let end = after.length;
  for (const other of allLabels) {
    if (other === label) continue;
    const otherIdx = after.indexOf(other);
    if (otherIdx !== -1 && otherIdx < end) end = otherIdx;
  }
  return after.slice(0, Math.min(end, 300)).trim().replace(/^[:\s]+/, "") || null;
}

// The sponsoring organization's name sits right after the title and right
// before a logo image filename (e.g. "Trinity University" then
// "TU logo.jpg") — a reliable structural marker confirmed across all 5
// real pages checked. Cross-referencing this name against our own
// verified university list (schoolNames) is a more reliable way to
// classify "university vs. external" than any on-page label, since the
// "HEI Financial Aid" / "Financial Aid (Country Based)" tags we originally
// spotted turned out not to exist on these pages at all.
function extractSponsoringOrg(text, title, debug) {
  const titleIdx = text.lastIndexOf(title);
  if (debug) {
    console.log(`  [debug] searching for title: "${title}"`);
    console.log(`  [debug] lastIndexOf result: ${titleIdx}`);
    if (titleIdx === -1) {
      // Show what the text actually contains near where we'd expect the
      // title, so a mismatch (extra whitespace, different casing, a
      // truncated title, etc.) is visible instead of guessed at again.
      console.log(`  [debug] title NOT found. Full page text length: ${text.length}`);
      console.log(`  [debug] first 300 chars of page text:\n${text.slice(0, 300)}`);
    }
  }
  if (titleIdx === -1) return null;
  const after = text.slice(titleIdx + title.length, titleIdx + title.length + 400);
  const imageMatch = after.match(/\.(jpg|jpeg|png|gif)\b/i);
  if (debug && !imageMatch) {
    console.log(`  [debug] title WAS found, but no image extension in the 400 chars after it:\n${after}`);
  }
  if (!imageMatch) return null;
  const beforeImage = after.slice(0, imageMatch.index);
  // The org name is the FIRST non-empty line in this section — the logo
  // filename itself (e.g. "UWS Logo") is a later line in the same
  // section, so taking the whole block would wrongly append it.
  const firstLine = beforeImage.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  return firstLine || null;
}

// Strips common filler words/punctuation so naming differences between
// EducationUSA's display name and College Scorecard's official name
// (e.g. "Ohio Wesleyan" vs "Ohio Wesleyan University", or a trailing
// "-Main Campus" style campus qualifier) don't cause a real match to be
// missed. Both sides get the same normalization, so a genuine match still
// compares cleanly even with words stripped from both.
function normalizeForMatch(name) {
  return name
    .toLowerCase()
    .replace(/-[^-]+$/, "") // trailing "-Main Campus" / "-Los Angeles" style campus suffix
    .replace(/&/g, "and")
    .replace(/[.,']/g, "")
    .replace(/\b(university|college|institute|the|of|at|and)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyType(orgName, schoolNames) {
  if (!orgName) return "unknown";
  const normalizedOrg = normalizeForMatch(orgName);
  if (!normalizedOrg) return "unknown"; // name was ONLY filler words — too ambiguous to match
  const isKnownUniversity = schoolNames.some((name) => {
    const normalizedSchool = normalizeForMatch(name);
    return normalizedSchool === normalizedOrg || normalizedSchool.includes(normalizedOrg) || normalizedOrg.includes(normalizedSchool);
  });
  return isKnownUniversity ? "university" : "external";
}

// Fallback for pages with no logo image at all (confirmed real on a live
// run — some scholarship pages skip straight from title into the
// description with no separate org-name/logo block, breaking the
// primary image-anchored extraction entirely). Many titles already name
// their university directly (e.g. "Ohio Wesleyan's Bashford Award"), so
// checking the title text itself recovers a real number of these.
function classifyFromTitle(title, schoolNames) {
  const normalizedTitle = normalizeForMatch(title);
  const match = schoolNames.find((name) => {
    const normalizedSchool = normalizeForMatch(name);
    // Require a reasonably substantial school name match (avoid a short,
    // generic normalized name like "state" matching almost anything).
    return normalizedSchool.length > 5 && normalizedTitle.includes(normalizedSchool);
  });
  return match ? "university" : null;
}

function parseDetailPage(html, url, title, schoolNames, debug) {
  const text = htmlToText(html);

  const orgName = extractSponsoringOrg(text, title, debug);
  let type = classifyType(orgName, schoolNames);
  if (type === "unknown") {
    type = classifyFromTitle(title, schoolNames) || "unknown";
  }

  const location = extractField(text, "Location", DETAIL_LABELS);
  const deadline = extractField(text, "Scholarship Deadline", DETAIL_LABELS);
  const degreeLevels = extractField(text, "Degree levels", DETAIL_LABELS);
  const duration = extractField(text, "Duration of Award", DETAIL_LABELS);
  const maxAward = extractField(text, "Maximum amount of award", DETAIL_LABELS);
  const majors = extractField(text, "Restricted to these majors", DETAIL_LABELS) || extractField(text, "Majors", DETAIL_LABELS);

  // "Location" only appears at all on country-tied scholarships — absent
  // entirely (as on every HEI example checked) correctly means open to
  // all nationalities, since EducationUSA's whole audience is
  // international students by default.
  const openToAllNationalities = !location || /^all$/i.test(location);

  return {
    title,
    url,
    sponsoringOrg: orgName,
    type,
    openToAllNationalities,
    eligibleCountry: openToAllNationalities ? null : location,
    deadline,
    degreeLevels,
    duration,
    maxAward,
    majors,
  };
}

async function fetchListingPage(page, logDiagnostic) {
  const url = `${LISTING_URL}?field_scholarship_degree_levels_tid=${BACHELORS_DEGREE_LEVEL_TID}&field_us_state_territory_tid=All&page=${page}`;
  let res;
  try {
    res = await fetchWithRetry(url);
  } catch (err) {
    if (logDiagnostic) console.log(`\nFetch to ${url} threw an error: ${err.message}`);
    return [];
  }

  if (logDiagnostic) {
    console.log(`\nDiagnostic — request to ${url}`);
    console.log(`  Status: ${res.status} ${res.statusText}`);
    console.log(`  Headers: ${JSON.stringify(Object.fromEntries(res.headers.entries()))}`);
  }

  if (!res.ok) {
    if (logDiagnostic) console.log(`  Response NOT ok — this is likely why 0 results came back.`);
    return [];
  }

  const html = await res.text();
  if (logDiagnostic) {
    console.log(`  Response body length: ${html.length} characters`);
    console.log(`  First 500 characters of body:\n${html.slice(0, 500)}`);
  }
  return parseListingPage(html);
}

async function fetchDetailPage(url, title, dumpRaw, schoolNames, debugOrgExtraction) {
  const res = await fetchWithRetry(url).catch(() => null);
  if (!res || !res.ok) return null;
  const html = await res.text();

  if (dumpRaw) {
    // Full untruncated text dump of ONE real detail page — our label-
    // guessing approach clearly missed the real structure last run (type
    // detection failed completely, field boundaries leaked into footer
    // content). Rather than guess a third time, see the real thing.
    const fullText = htmlToText(html);
    console.log(`\n=== FULL RAW TEXT DUMP: ${title} ===`);
    console.log(fullText);
    console.log(`=== END DUMP (${fullText.length} characters) ===\n`);
  }

  return parseDetailPage(html, url, title, schoolNames, debugOrgExtraction);
}

const CONCURRENCY = 5; // smaller than our other scripts — this is a small government site, be gentle

async function main() {
  console.log("Fetching Bachelor's-level scholarship listings from EducationUSA...");

  // Load our own verified university names to cross-reference against —
  // this is how we classify a scholarship as "university-specific" vs.
  // "external organization," since the on-page category labels we
  // originally spotted turned out not to exist on these pages at all.
  const schoolsPath = path.join(__dirname, "..", "data", "schools.json");
  const schoolNames = JSON.parse(fs.readFileSync(schoolsPath, "utf8")).map((s) => s.name);
  console.log(`Loaded ${schoolNames.length} known university names for cross-referencing.`);

  // First, page through the listing to collect every scholarship's URL.
  // Real results come 11 per page (confirmed from a live run); a page
  // returning fewer than that — but still more than 0 — is the last real
  // page. A page returning exactly 0-1 links (a stray nav/footer link
  // matching our URL pattern, not real results) means we've run past the
  // end, so stop there rather than continuing to a safety cap.
  let allListings = [];
  let page = 0;
  let loggedListingSample = false;
  while (true) {
    const listings = await fetchListingPage(page, page === 0);
    if (!loggedListingSample) {
      console.log(`\nSample parsed listing links from page 0 (for verifying parsing worked):\n`, JSON.stringify(listings.slice(0, 5), null, 2));
      loggedListingSample = true;
    }
    if (listings.length <= 1) break; // 0 or a single stray link = past real results
    allListings = allListings.concat(listings);
    console.log(`  page ${page}: ${listings.length} links found (${allListings.length} total so far)`);
    page += 1;
    if (page > 20) break; // hard safety cap regardless
    await new Promise((r) => setTimeout(r, 300));
  }

  // De-duplicate by URL — the same scholarship can appear on multiple
  // listing pages if results shift between requests.
  const uniqueListings = Array.from(new Map(allListings.map((l) => [l.url, l])).values());
  console.log(`\nFound ${uniqueListings.length} unique scholarship links. Fetching full details for each...`);

  const results = [];
  let index = 0;
  let completed = 0;
  let loggedDetailSample = false;
  let failureDebugCount = 0;
  const MAX_FAILURE_DEBUGS = 3;

  async function worker() {
    while (index < uniqueListings.length) {
      const i = index++;
      const { url, title } = uniqueListings[i];
      try {
        const detail = await fetchDetailPage(url, title, false, schoolNames, false);
        if (detail) {
          if (detail.sponsoringOrg === null && failureDebugCount < MAX_FAILURE_DEBUGS) {
            // Re-fetch with debug logging on for real failing cases —
            // shows exactly whether the title was found on the page at
            // all, and if so, why the image-extension anchor after it
            // didn't work. This is targeted at the actual problem instead
            // of guessing again from a successful example.
            failureDebugCount++;
            console.log(`\n=== Debugging failure #${failureDebugCount}: "${title}" ===`);
            await fetchDetailPage(url, title, false, schoolNames, true);
          }
          results.push(detail);
          if (!loggedDetailSample) {
            console.log("\nSample parsed result (verifying the rebuilt extraction logic):\n", JSON.stringify(detail, null, 2));
            loggedDetailSample = true;
          }
        }
      } catch (err) {
        console.log(`  error on ${title}: ${err.message}`);
      }
      completed++;
      if (completed % 20 === 0 || completed === uniqueListings.length) {
        console.log(`  ${completed}/${uniqueListings.length} detail pages processed`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const outPath = path.join(__dirname, "..", "data", "scholarships.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nSaved ${results.length} scholarships to ${outPath}`);

  const universityCount = results.filter((r) => r.type === "university").length;
  const externalCount = results.filter((r) => r.type === "external").length;
  const unknownCount = results.filter((r) => r.type === "unknown").length;
  console.log(`  University-specific: ${universityCount} | External organization: ${externalCount} | Unclassified: ${unknownCount}`);

  // Diagnostic: 100/130 "unclassified" on the first real run is very
  // likely a matching-logic problem, not a true reflection of the data —
  // every sample checked by hand so far was a genuine university. List
  // the actual org names that failed to match, so the real cause (naming
  // mismatch vs. genuinely-unmatched) is visible instead of guessed again.
  const unclassifiedOrgs = results.filter((r) => r.type === "unknown").map((r) => r.sponsoringOrg);
  console.log(`\nOrg names that failed to classify (${unclassifiedOrgs.length} total):`);
  console.log(JSON.stringify(unclassifiedOrgs, null, 2));
}

main().catch((err) => {
  console.error("Scholarships fetch failed:", err.message);
  process.exit(1);
});

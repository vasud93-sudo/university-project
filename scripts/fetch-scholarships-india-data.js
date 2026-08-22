// Pulls scholarships open to Indian students from fundingusstudy.org,
// maintained by the Institute of International Education (IIE) — the
// nonprofit that administers Fulbright logistics for the US State
// Department. Scoped to India (area=2 Asia, area2=7 South/Central Asia,
// area3=68 India — confirmed live against the real site's own breadcrumb
// "Region: Asia - South/Central Asia - India").
//
// Design notes, applying every lesson learned from scripts/fetch-scholarships-data.js:
// - Title, sponsoring org, logo, and eligibility text are all directly
//   visible on the LISTING page itself (confirmed from real fetched
//   data) — no risky detail-page extraction needed for those fields.
// - This site does NOT paginate the way EducationUSA does — the "page=N"
//   in each listing's URL is that listing's own rank/position, not a
//   real "next page" control. One request returns the full result set.
// - Only degree-level (Bachelor's) filtering requires visiting each
//   detail page. Since we don't have confirmed visibility into that
//   page's exact structure, this uses a ROBUST KEYWORD SEARCH across the
//   whole page text (not fragile label-position matching), plus a full
//   raw-text debug dump on the first page — so even an imperfect first
//   guess still gives complete diagnostic visibility, not just a guess.
//
// Usage:
//   node scripts/fetch-scholarships-india-data.js

const fs = require("fs");
const path = require("path");

const BASE_URL = "https://fundingusstudy.org";
const LISTING_URL = `${BASE_URL}/SearchResult.asp?area=2&area2=7&area3=68`;
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

// One retry after a pause — a single slow response shouldn't kill the run
// (confirmed necessary on the EducationUSA build).
async function fetchWithRetry(url, options = {}, timeoutMs = 20000) {
  try {
    return await fetchWithTimeout(url, options, timeoutMs);
  } catch (err) {
    await new Promise((r) => setTimeout(r, 2000));
    return fetchWithTimeout(url, options, timeoutMs);
  }
}

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

// Parses one row from the listing page. Real, confirmed structure: each
// row has a title link to a Listing.asp?...PID={...} URL, followed by the
// sponsoring org name and eligibility text as nearby page content.
//
// Deliberately NOT anchored to specific formatting tags (bold/strong/etc)
// — we don't have confirmed visibility into the exact real markup, only
// what's rendered for reading. Instead: find every real <a> link (an
// actual, guaranteed-real HTML structure), then treat the HTML between
// one title link and the next as that row's content, converting it to
// plain text and searching within it. This is robust to whatever the
// real formatting tags turn out to be.
function parseListingRows(html) {
  const linkPattern = /<a[^>]+href="([^"]*Listing\.asp\?[^"]*PID=\{[^}]+\}[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const allLinks = [];
  let m;
  while ((m = linkPattern.exec(html)) !== null) {
    // Text may be wrapped in nested tags (e.g. <b>Title</b>) — clean it
    // through htmlToText instead of a naive [^<]* capture, which breaks
    // the instant it hits any nested tag (confirmed real: this exact bug
    // caused zero matches against realistic markup on the first attempt).
    const cleanText = htmlToText(m[2]);
    allLinks.push({ index: m.index, end: m.index + m[0].length, url: m[1], text: cleanText });
  }

  // Diagnostic: a simple, regex-independent substring count of how many
  // times "PID={" actually appears in the raw HTML at all. If this is
  // also low (nowhere near ~1316 for 658 rows x 2 links), the real
  // problem isn't the regex — it means most results aren't in the
  // initial HTML at all, and load separately via JavaScript after page
  // load (the same situation we hit with FairTest, needing a different
  // endpoint entirely, not a regex fix).
  const rawPidOccurrences = (html.match(/PID=\{/g) || []).length;
  console.log(`\n[diagnostic] Raw regex matches (allLinks): ${allLinks.length}`);
  console.log(`[diagnostic] Raw substring count of "PID={" in full HTML: ${rawPidOccurrences}`);
  if (rawPidOccurrences > allLinks.length * 2) {
    console.log(`[diagnostic] Substring count is much higher than regex matches — this points to a REGEX bug, not missing data.`);
  } else if (rawPidOccurrences < 20) {
    console.log(`[diagnostic] Substring count itself is low — most results likely load via JavaScript AFTER initial page load, not present in this HTML at all. This would need a different fetch approach entirely (like the AJAX endpoint we found for FairTest), not a regex fix.`);
  }

  // Each row typically has TWO links to the same scholarship — one
  // wrapping the logo image (no text content), one wrapping the title
  // (real text). Keep only the text-bearing one per unique PID.
  const seenPid = new Set();
  const titleLinks = [];
  for (const link of allLinks) {
    const pidMatch = link.url.match(/PID=(\{[^}]+\})/);
    const pid = pidMatch ? pidMatch[1] : link.url;
    if (!link.text || link.text.length < 2) continue; // an image-wrapping link has no text
    if (seenPid.has(pid)) continue;
    seenPid.add(pid);
    titleLinks.push({ ...link, pid });
  }

  const results = [];
  for (let i = 0; i < titleLinks.length; i++) {
    const windowStart = titleLinks[i].end;
    const windowEnd = i + 1 < titleLinks.length ? titleLinks[i + 1].index : Math.min(html.length, windowStart + 2000);
    const windowText = htmlToText(html.slice(windowStart, windowEnd));

    const eligMatch = windowText.match(/open to students from ([^\n]+)/i);
    const eligibilityText = eligMatch ? `Open to students from ${eligMatch[1].trim()}` : "";

    // Org name: the first substantial line of nearby text that isn't the
    // eligibility line itself.
    const orgLine = windowText
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 1 && !/^open to students from/i.test(l)) || "";

    const title = titleLinks[i].text;
    results.push({
      pid: titleLinks[i].pid,
      title: title || "##NO AWARD NAME##",
      isInactive: /^inactive$/i.test(title.trim()),
      hasNoName: /##NO AWARD NAME##/i.test(title),
      sponsoringOrg: orgLine,
      eligibilityText,
      detailUrl: titleLinks[i].url.startsWith("http") ? titleLinks[i].url : `${BASE_URL}/${titleLinks[i].url.replace(/^\//, "")}`,
    });
  }

  return results;
}

function classifyEligibility(eligibilityText) {
  if (/open to students from india/i.test(eligibilityText)) return { scope: "india-specific" };
  if (/open to students from any region/i.test(eligibilityText)) return { scope: "any-region" };
  // Any other "Open to students from X" (e.g. "South/Central Asia", "Asia")
  // is a broader region India is genuinely part of.
  const regionMatch = eligibilityText.match(/open to students from (.+)/i);
  return { scope: "broader-region", region: regionMatch ? regionMatch[1].trim() : null };
}

// Same normalization + classification logic proven on the EducationUSA
// build (tested against 9 real cases, including genuinely-external
// organizations that correctly stayed unmatched).
function normalizeForMatch(name) {
  return name
    .toLowerCase()
    .replace(/-[^-]+$/, "")
    .replace(/&/g, "and")
    .replace(/[.,']/g, "")
    .replace(/\b(university|college|institute|the|of|at|and)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyType(orgName, schoolNames) {
  if (!orgName) return "unknown";
  const normalizedOrg = normalizeForMatch(orgName);
  if (!normalizedOrg) return "unknown";
  const isKnownUniversity = schoolNames.some((name) => {
    const normalizedSchool = normalizeForMatch(name);
    return normalizedSchool === normalizedOrg || normalizedSchool.includes(normalizedOrg) || normalizedOrg.includes(normalizedSchool);
  });
  return isKnownUniversity ? "university" : "external";
}

// Robust keyword search for degree-level relevance — deliberately NOT
// anchored to a specific label position we haven't confirmed exists on
// this site's detail pages. Looks for bachelor's/undergraduate language
// ANYWHERE in the page, and separately checks whether the page appears to
// be graduate-only (mentions graduate/master's/doctoral but never
// undergraduate/bachelor's at all).
function checkBachelorsRelevance(pageText) {
  const mentionsBachelors = /\b(bachelor|undergraduate)/i.test(pageText);
  const mentionsGradOnly = /\b(graduate|master'?s|doctoral|phd|ph\.d)/i.test(pageText) && !mentionsBachelors;
  return {
    likelyBachelorsRelevant: mentionsBachelors,
    likelyGraduateOnly: mentionsGradOnly,
  };
}

// The detail page has a direct "Sponsor Type: X" field (confirmed real:
// "Sponsor Type: Non-Profit Organization/Agency/Association") — a much
// more reliable type signal than fuzzy name-matching, when it's present.
// Falls back to null (letting the name-match classifier decide) if this
// field isn't found or doesn't map to a known category.
function checkSponsorType(pageText) {
  const match = pageText.match(/Sponsor Type:\s*([^\n]+)/i);
  if (!match) return null;
  const value = match[1].trim();
  if (/university|college|institute|school/i.test(value)) return "university";
  if (/non-?profit|government|association|agency|foundation|corporation/i.test(value)) return "external";
  return null; // an unrecognized category — don't guess, let the fallback decide
}

async function fetchDetailPageText(url, dumpRaw) {
  const res = await fetchWithRetry(url).catch(() => null);
  if (!res || !res.ok) return null;
  const html = await res.text();
  const text = htmlToText(html);

  if (dumpRaw) {
    console.log(`\n=== FULL RAW TEXT DUMP (detail page, for verifying degree-level detection) ===`);
    console.log(text);
    console.log(`=== END DUMP (${text.length} characters) ===\n`);
  }

  return text;
}

const CONCURRENCY = 5; // gentle pacing, same as the EducationUSA script

async function main() {
  console.log("Fetching India-eligible scholarships from fundingusstudy.org (IIE)...");

  const schoolsPath = path.join(__dirname, "..", "data", "schools.json");
  const schoolNames = JSON.parse(fs.readFileSync(schoolsPath, "utf8")).map((s) => s.name);
  console.log(`Loaded ${schoolNames.length} known university names for cross-referencing.`);

  const res = await fetchWithRetry(LISTING_URL).catch(() => null);
  if (!res || !res.ok) {
    console.error("Failed to fetch the listing page — aborting.");
    process.exit(1);
  }
  const html = await res.text();
  console.log(`Listing page fetched: ${html.length} characters.`);

  const rows = parseListingRows(html);
  console.log(`\nParsed ${rows.length} listing rows from the page.`);
  console.log("Sample of first 5 parsed rows (for verifying parsing worked):\n", JSON.stringify(rows.slice(0, 5), null, 2));

  // Diagnostic: the first entry parsed perfectly, but if far fewer rows
  // came back than expected (~658), the regex likely isn't matching
  // entries beyond the first — possibly because the first/featured
  // listing uses different markup than the regular repeating rows below
  // it. Search for a scholarship we know exists further down the real
  // page ("East-West Center Graduate Degree Fellowship", the second real
  // result) and dump the raw HTML around it, so we can see its actual
  // structure directly instead of guessing again.
  if (rows.length < 100) {
    const knownSecondEntry = "East-West Center Graduate Degree Fellowship";
    const idx = html.indexOf(knownSecondEntry);
    console.log(`\n--- Diagnostic: only ${rows.length} row(s) parsed, expected ~658 ---`);
    if (idx === -1) {
      console.log(`Could not find "${knownSecondEntry}" anywhere in the raw HTML at all.`);
    } else {
      console.log(`Found "${knownSecondEntry}" at character ${idx}. Raw HTML from 400 characters before to 400 after:\n`);
      console.log(html.slice(Math.max(0, idx - 400), idx + 400));
    }
    console.log("--- End diagnostic ---\n");
  }

  if (rows.length === 0) {
    console.error("\nZero rows parsed — the listing page's real markup doesn't match the assumed pattern. Stopping here rather than guessing further blindly.");
    console.log("First 2000 characters of raw HTML, for diagnosing the real structure:\n", html.slice(0, 2000));
    process.exit(1);
  }

  const results = [];
  let index = 0;
  let completed = 0;
  let loggedDetailDump = false;

  async function worker() {
    while (index < rows.length) {
      const i = index++;
      const row = rows[i];
      try {
        const pageText = await fetchDetailPageText(row.detailUrl, !loggedDetailDump);
        loggedDetailDump = true;

        const { scope, region } = classifyEligibility(row.eligibilityText);
        const nameBasedType = classifyType(row.sponsoringOrg, schoolNames);
        const sponsorTypeFromPage = pageText ? checkSponsorType(pageText) : null;
        // Prefer the site's own direct "Sponsor Type" field when present
        // and recognized — only fall back to name-matching when it isn't.
        const type = sponsorTypeFromPage || nameBasedType;
        const bachelors = pageText ? checkBachelorsRelevance(pageText) : { likelyBachelorsRelevant: null, likelyGraduateOnly: null };

        results.push({
          title: row.title,
          isInactive: row.isInactive,
          hasNoName: row.hasNoName,
          sponsoringOrg: row.sponsoringOrg,
          type,
          eligibilityScope: scope,
          eligibleRegion: region,
          detailUrl: row.detailUrl,
          ...bachelors,
        });
      } catch (err) {
        console.log(`  error on "${row.title}": ${err.message}`);
      }
      completed++;
      if (completed % 25 === 0 || completed === rows.length) {
        console.log(`  ${completed}/${rows.length} detail pages processed`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const outPath = path.join(__dirname, "..", "data", "scholarships-india.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nSaved ${results.length} scholarships to ${outPath}`);

  const bachelorsCount = results.filter((r) => r.likelyBachelorsRelevant).length;
  const gradOnlyCount = results.filter((r) => r.likelyGraduateOnly).length;
  const universityCount = results.filter((r) => r.type === "university").length;
  const externalCount = results.filter((r) => r.type === "external").length;
  const inactiveCount = results.filter((r) => r.isInactive || r.hasNoName).length;
  console.log(`  Likely Bachelor's-relevant: ${bachelorsCount} | Likely graduate-only: ${gradOnlyCount}`);
  console.log(`  University-specific: ${universityCount} | External organization: ${externalCount}`);
  console.log(`  Flagged as Inactive/no-name: ${inactiveCount}`);
}

main().catch((err) => {
  console.error("India scholarships fetch failed:", err.message);
  process.exit(1);
});

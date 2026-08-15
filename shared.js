// Shared across index.html and school.html — loaded before app.js/school.js.
// Keeping this in one file means your logo.dev token only needs to be set
// in ONE place, not duplicated across every page that shows a logo.

// Real logo via logo.dev, which maintains genuine coverage for US
// universities (confirmed: Harvard, MIT, Stanford, and 90+ others in
// their college-logos set) — unlike some general-purpose logo APIs,
// which are built for tech/SaaS company domains and don't reliably
// cover .edu domains. Requires a free API token: sign up at
// https://www.logo.dev/signup, then paste your token below.
const LOGO_DEV_TOKEN = "REPLACE_WITH_YOUR_TOKEN"; // <-- paste your free logo.dev token here

// Escapes HTML-significant characters before interpolating any data-sourced
// string into markup. The data here comes from a trusted federal API today,
// but this is cheap insurance against XSS if a less-trusted source (user
// submissions, a scraped feed, etc.) ever gets added later.
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Generates 1-2 letter initials, used as the fallback shown if a school's
// real logo fails to load (missing domain, no logo on file, network error).
const INITIALS_STOPWORDS = new Set(["university", "of", "the", "and", "at", "in", "for", "main", "campus"]);
function initialsFor(name) {
  const words = name
    .split(/[\s-]+/)
    .filter((w) => w && !INITIALS_STOPWORDS.has(w.toLowerCase()));
  const letters = words.slice(0, 2).map((w) => w[0].toUpperCase());
  return letters.join("") || name[0]?.toUpperCase() || "?";
}

// Strips protocol/www/path down to a bare domain, e.g.
// "https://www.harvard.edu/admissions" -> "harvard.edu"
function bareDomain(url) {
  if (!url) return null;
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim() || null;
}

// Builds the avatar/logo markup. sizeClass lets different pages use
// different circle sizes (e.g. "uni-card-avatar" for grid cards,
// "school-avatar" for the larger detail-page header) while sharing all
// the actual logic. Falls back to the initials badge if the image 404s,
// the token is missing, or the school has no usable domain on file.
function avatarHtml(s, sizeClass) {
  const initials = initialsFor(s.name);
  const domain = bareDomain(s.url);
  if (!domain || !LOGO_DEV_TOKEN) {
    return `<div class="${sizeClass}">${escapeHtml(initials)}</div>`;
  }

  const fallbackHtml = `<div class='${sizeClass}'>${escapeHtml(initials)}</div>`.replace(/"/g, "&quot;");
  return `<img class="${sizeClass}" src="https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(LOGO_DEV_TOKEN)}&size=128&format=webp" alt="" data-fallback="${fallbackHtml}" onerror="this.replaceWith(document.createRange().createContextualFragment(this.dataset.fallback))" />`;
}

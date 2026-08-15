const STORAGE_KEY = "uni-catalog-shortlist";

let schools = [];
let cdsIds = new Set(); // ids of schools that have CDS data available
let shortlistIds = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));

const els = {
  search: document.getElementById("f-search"),
  state: document.getElementById("f-state"),
  major: document.getElementById("f-major"),
  ownership: document.getElementById("f-ownership"),
  tuition: document.getElementById("f-tuition"),
  admit: document.getElementById("f-admit"),
  cds: document.getElementById("f-cds"),
  sort: document.getElementById("f-sort"),
  grid: document.getElementById("card-grid"),
  resultCount: document.getElementById("result-count"),
  emptyState: document.getElementById("empty-state"),
  drawer: document.getElementById("shortlist-drawer"),
  drawerToggle: document.getElementById("shortlist-toggle"),
  drawerClose: document.getElementById("drawer-close"),
  overlay: document.getElementById("drawer-overlay"),
  shortlistItems: document.getElementById("shortlist-items"),
  shortlistCount: document.getElementById("shortlist-count"),
  exportBtn: document.getElementById("export-csv"),
  clearBtn: document.getElementById("clear-shortlist"),
};

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

const fmtMoney = (n) => (n == null ? "—" : `$${Number(n).toLocaleString()}`);
const fmtPct = (n) => (n == null ? "—" : `${Math.round(n * 100)}%`);
const fmtInt = (n) => (n == null ? "—" : Number(n).toLocaleString());

async function init() {
  const [schoolsRes, cds] = await Promise.all([
    fetch("data/schools.json").then((r) => r.json()),
    fetch("data/cds.json").then((r) => r.json()).catch(() => ({})),
  ]);
  schools = schoolsRes;
  cdsIds = new Set(
    Object.values(cds)
      .filter((record) => record.hasCdsData)
      .map((record) => record.id)
  );
  populateStateFilter();
  populateMajorFilter();
  bindEvents();
  render();
  saveShortlist(); // sync count badge on load
}

function populateStateFilter() {
  const states = [...new Set(schools.map((s) => s.state))].sort();
  for (const st of states) {
    const opt = document.createElement("option");
    opt.value = st;
    opt.textContent = st;
    els.state.appendChild(opt);
  }
}

function populateMajorFilter() {
  const majors = [...new Set(schools.flatMap((s) => s.topPrograms || []))].sort();
  for (const major of majors) {
    const opt = document.createElement("option");
    opt.value = major;
    opt.textContent = major;
    els.major.appendChild(opt);
  }
}

function bindEvents() {
  [els.search, els.state, els.major, els.ownership, els.tuition, els.admit, els.cds, els.sort].forEach((el) =>
    el.addEventListener("input", render)
  );

  els.drawerToggle.addEventListener("click", () => setDrawer(true));
  els.drawerClose.addEventListener("click", () => setDrawer(false));
  els.overlay.addEventListener("click", () => setDrawer(false));
  els.exportBtn.addEventListener("click", exportCsv);
  els.clearBtn.addEventListener("click", () => {
    shortlistIds.clear();
    saveShortlist();
    render();
  });
}

function setDrawer(open) {
  els.drawer.classList.toggle("open", open);
  els.drawer.setAttribute("aria-hidden", String(!open));
  els.overlay.hidden = !open;
  els.drawerToggle.setAttribute("aria-expanded", String(open));
}

function getFiltered() {
  const q = els.search.value.trim().toLowerCase();
  const state = els.state.value;
  const major = els.major.value;
  const ownership = els.ownership.value;
  const maxTuition = els.tuition.value ? Number(els.tuition.value) : null;
  const minAdmit = els.admit.value ? Number(els.admit.value) : null;
  const cdsFilter = els.cds.value;

  let list = schools.filter((s) => {
    if (q && !`${s.name} ${s.city}`.toLowerCase().includes(q)) return false;
    if (state && s.state !== state) return false;
    if (major && !(s.topPrograms || []).includes(major)) return false;
    if (ownership && s.ownership !== ownership) return false;
    if (maxTuition != null && (s.tuitionOutOfState == null || s.tuitionOutOfState > maxTuition)) return false;
    if (minAdmit != null && (s.admissionRate == null || s.admissionRate < minAdmit)) return false;
    if (cdsFilter === "yes" && !cdsIds.has(s.id)) return false;
    if (cdsFilter === "no" && cdsIds.has(s.id)) return false;
    return true;
  });

  const sortKey = els.sort.value;
  list.sort((a, b) => {
    switch (sortKey) {
      case "tuition":
        return (a.tuitionOutOfState ?? Infinity) - (b.tuitionOutOfState ?? Infinity);
      case "admitRate":
        return (a.admissionRate ?? Infinity) - (b.admissionRate ?? Infinity);
      case "earnings":
        return (b.medianEarnings10yr ?? -Infinity) - (a.medianEarnings10yr ?? -Infinity);
      case "gradRate":
        return (b.gradRate4yr ?? -Infinity) - (a.gradRate4yr ?? -Infinity);
      default:
        return a.name.localeCompare(b.name);
    }
  });

  return list;
}

function render() {
  const list = getFiltered();
  els.resultCount.textContent = `${list.length} school${list.length === 1 ? "" : "s"} on file`;
  els.emptyState.hidden = list.length !== 0;
  els.grid.innerHTML = list.map(cardHtml).join("");

  els.grid.querySelectorAll(".pull-button").forEach((btn) => {
    btn.addEventListener("click", () => togglePull(Number(btn.dataset.id)));
  });

  renderShortlist();
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

// Real logo via logo.dev, which maintains genuine coverage for US
// universities (confirmed: Harvard, MIT, Stanford, and 90+ others in
// their college-logos set) — unlike some general-purpose logo APIs,
// which are built for tech/SaaS company domains and don't reliably
// cover .edu domains. Requires a free API token: sign up at
// https://www.logo.dev/signup, then paste your token below.
// Falls back to the initials badge if the image 404s, the token is
// missing, or the school has no usable domain on file.
const LOGO_DEV_TOKEN = "pk_M41PnphQQySRY99z9ZQobw"; // <-- paste your free logo.dev token here

function avatarHtml(s) {
  const initials = initialsFor(s.name);
  const domain = bareDomain(s.url);
  if (!domain || !LOGO_DEV_TOKEN) {
    return `<div class="uni-card-avatar">${escapeHtml(initials)}</div>`;
  }

  const fallbackHtml = `<div class='uni-card-avatar'>${escapeHtml(initials)}</div>`.replace(/"/g, "&quot;");
  return `<img class="uni-card-avatar" src="https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(LOGO_DEV_TOKEN)}&size=92&format=webp" alt="" data-fallback="${fallbackHtml}" onerror="this.replaceWith(document.createRange().createContextualFragment(this.dataset.fallback))" />`;
}

function cardHtml(s) {
  const pulled = shortlistIds.has(s.id);
  return `
    <article class="uni-card">
      <div class="uni-card-head">
        ${avatarHtml(s)}
        <div class="uni-card-head-text">
          <span class="uni-card-tag">${escapeHtml(s.ownership)}</span>
          <h3 class="uni-card-name">${escapeHtml(s.name)}</h3>
          <span class="uni-card-loc">${escapeHtml(s.city)}, ${escapeHtml(s.state)}</span>
        </div>
      </div>
      <div class="uni-card-stats">
        <div><span class="stat-label">Tuition (out-of-state)</span><span class="stat-value">${fmtMoney(s.tuitionOutOfState)}</span></div>
        <div><span class="stat-label">Admission rate</span><span class="stat-value">${fmtPct(s.admissionRate)}</span></div>
        <div><span class="stat-label">4-yr grad rate</span><span class="stat-value">${fmtPct(s.gradRate4yr)}</span></div>
        <div><span class="stat-label" title="Based on federal financial-aid records; may not reflect international students, who are generally not part of this data. See Methodology.">Median earnings (10yr)&nbsp;ⓘ</span><span class="stat-value">${fmtMoney(s.medianEarnings10yr)}</span></div>
        <div><span class="stat-label">Enrollment</span><span class="stat-value">${fmtInt(s.enrollment)}</span></div>
      </div>
      ${programsHtml(s.topPrograms)}
      <div class="uni-card-foot">
        <a class="uni-card-link" href="https://${encodeURIComponent(s.url || "")}" target="_blank" rel="noopener">${escapeHtml(s.url)}</a>
        <div class="uni-card-actions">
          <div class="uni-card-actions-left">
            <a class="details-link" href="school.html?id=${encodeURIComponent(s.id)}">Details &rarr;</a>
            ${cdsIds.has(s.id) ? '<span class="cds-indicator">CDS data</span>' : ""}
          </div>
          <button class="pull-button ${pulled ? "pulled" : ""}" data-id="${s.id}">
            ${pulled ? "✓ On shortlist" : "+ Pull card"}
          </button>
        </div>
      </div>
    </article>
  `;
}

function programsHtml(topPrograms) {
  if (!topPrograms || topPrograms.length === 0) return "";
  const shown = topPrograms.slice(0, 4);
  const remaining = topPrograms.length - shown.length;
  const chips = shown.map((p) => `<span class="major-chip">${escapeHtml(p)}</span>`).join("");
  const more = remaining > 0 ? `<span class="major-chip major-chip-more">+${remaining} more</span>` : "";
  return `
    <div class="uni-card-majors">
      <span class="stat-label">Top majors</span>
      <div class="major-chip-row">${chips}${more}</div>
    </div>
  `;
}

function togglePull(id) {
  if (shortlistIds.has(id)) shortlistIds.delete(id);
  else shortlistIds.add(id);
  saveShortlist();
  render();
}

function saveShortlist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...shortlistIds]));
  els.shortlistCount.textContent = shortlistIds.size;
}

function renderShortlist() {
  const items = schools.filter((s) => shortlistIds.has(s.id));
  els.shortlistItems.innerHTML = items
    .map(
      (s) => `
      <li>
        <span>${escapeHtml(s.name)}</span>
        <button aria-label="Remove ${escapeHtml(s.name)}" data-id="${s.id}">×</button>
      </li>`
    )
    .join("") || `<li style="justify-content:center; color:var(--ink-soft);">No cards pulled yet</li>`;

  els.shortlistItems.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => togglePull(Number(btn.dataset.id)));
  });
}

function exportCsv() {
  const items = schools.filter((s) => shortlistIds.has(s.id));
  if (items.length === 0) {
    alert("Pull a few cards first — your shortlist is empty.");
    return;
  }
  const headers = [
    "Name", "City", "State", "Type", "Tuition (in-state)", "Tuition (out-of-state)",
    "Admission rate", "Enrollment", "4yr Grad rate", "Median earnings (10yr)",
    "Top majors (bachelor's)", "URL",
  ];
  const rows = items.map((s) => [
    s.name, s.city, s.state, s.ownership,
    s.tuitionInState ?? "", s.tuitionOutOfState ?? "",
    s.admissionRate ?? "", s.enrollment ?? "", s.gradRate4yr ?? "",
    s.medianEarnings10yr ?? "", (s.topPrograms || []).join("; "), s.url ?? "",
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "my-university-shortlist.csv";
  a.click();
  URL.revokeObjectURL(url);
}

init();

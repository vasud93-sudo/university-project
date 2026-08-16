const STORAGE_KEY = "uni-catalog-shortlist";

let schools = [];
let cdsIds = new Set(); // ids of schools that have CDS data available
let cdsData = {}; // full CDS records, keyed by school id — used for priority scoring
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
  priorityPanel: document.getElementById("priority-panel"),
  prioritySliders: document.getElementById("priority-sliders"),
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

// escapeHtml, initialsFor, bareDomain, avatarHtml, and LOGO_DEV_TOKEN now
// live in shared.js (loaded before this file) so the grid and detail pages
// share one copy instead of duplicating logo/token logic.

const fmtMoney = (n) => (n == null ? "—" : `$${Number(n).toLocaleString()}`);
const fmtPct = (n) => (n == null ? "—" : `${Math.round(n * 100)}%`);
const fmtInt = (n) => (n == null ? "—" : Number(n).toLocaleString());

async function init() {
  const [schoolsRes, cds] = await Promise.all([
    fetch("data/schools.json").then((r) => r.json()),
    fetch("data/cds.json").then((r) => r.json()).catch(() => ({})),
  ]);
  schools = schoolsRes;
  cdsData = cds;
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
  const majors = [...new Set(schools.flatMap((s) => (s.topPrograms || []).map((p) => p.title)))].sort();
  for (const major of majors) {
    const opt = document.createElement("option");
    opt.value = major;
    opt.textContent = major;
    els.major.appendChild(opt);
  }
}

// Priority weighting for the "My priorities" sort mode. Each factor's
// score() returns a raw value that gets min-max normalized (0-1) across
// the currently filtered list before combining, and higher normalized
// score always means "better match for this priority" — direction is
// baked in here so the slider UI only needs one number per factor.
const PRIORITY_FACTORS = [
  { key: "affordability", label: "Affordability (lower cost)", score: (s) => (s.tuitionOutOfState != null ? -s.tuitionOutOfState : null) },
  { key: "outcomes", label: "Graduate earnings", score: (s) => s.medianEarnings10yr },
  { key: "admitChance", label: "Admission chances (less selective)", score: (s) => s.admissionRate },
  { key: "international", label: "International student community", score: (s) => cdsData[s.id]?.internationalEnrollmentPct ?? null },
  { key: "stemOpt", label: "STEM OPT-eligible majors offered", score: (s) => (s.topPrograms || []).filter((p) => p.coreStem).length },
];

function renderPrioritySliders() {
  els.prioritySliders.innerHTML = PRIORITY_FACTORS.map(
    (f) => `
    <div class="priority-slider-row">
      <label for="priority-${f.key}">${f.label}</label>
      <input type="range" id="priority-${f.key}" min="0" max="10" value="5" data-factor="${f.key}" />
      <span class="priority-slider-value" id="priority-${f.key}-out">5</span>
    </div>`
  ).join("");

  els.prioritySliders.querySelectorAll("input[type=range]").forEach((input) => {
    input.addEventListener("input", () => {
      document.getElementById(`priority-${input.dataset.factor}-out`).textContent = input.value;
      render();
    });
  });
}

function getPriorityWeights() {
  const weights = {};
  PRIORITY_FACTORS.forEach((f) => {
    const el = document.getElementById(`priority-${f.key}`);
    weights[f.key] = el ? Number(el.value) : 5;
  });
  return weights;
}

function bindEvents() {
  [els.search, els.state, els.major, els.ownership, els.tuition, els.admit, els.cds, els.sort].forEach((el) =>
    el.addEventListener("input", () => {
      els.priorityPanel.hidden = els.sort.value !== "priority";
      render();
    })
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

  renderPrioritySliders();
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
    if (major && !(s.topPrograms || []).some((p) => p.title === major)) return false;
    if (ownership && s.ownership !== ownership) return false;
    if (maxTuition != null && (s.tuitionOutOfState == null || s.tuitionOutOfState > maxTuition)) return false;
    if (minAdmit != null && (s.admissionRate == null || s.admissionRate < minAdmit)) return false;
    if (cdsFilter === "yes" && !cdsIds.has(s.id)) return false;
    if (cdsFilter === "no" && cdsIds.has(s.id)) return false;
    return true;
  });

  const sortKey = els.sort.value;

  if (sortKey === "priority") {
    return sortByPriority(list);
  }

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

// Min-max normalizes each priority factor across the currently filtered
// list (not the whole dataset), so scores stay meaningful even as filters
// narrow the pool. Schools missing a factor's data get 0 for that factor
// rather than being excluded — a real limitation (see Methodology), but
// better than silently dropping schools with incomplete CDS data.
function sortByPriority(list) {
  const weights = getPriorityWeights();
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return list.sort((a, b) => a.name.localeCompare(b.name));

  const ranges = {};
  PRIORITY_FACTORS.forEach((f) => {
    const values = list.map((s) => f.score(s)).filter((v) => v != null);
    ranges[f.key] = { min: Math.min(...values, 0), max: Math.max(...values, 1) };
  });

  function compositeScore(s) {
    let total = 0;
    PRIORITY_FACTORS.forEach((f) => {
      const raw = f.score(s);
      const { min, max } = ranges[f.key];
      const normalized = raw == null || max === min ? 0 : (raw - min) / (max - min);
      total += weights[f.key] * normalized;
    });
    return total / totalWeight;
  }

  return list
    .map((s) => ({ s, score: compositeScore(s) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);
}

let gridListenerAttached = false;

function render() {
  const list = getFiltered();
  els.resultCount.textContent = `${list.length} school${list.length === 1 ? "" : "s"} on file`;
  els.emptyState.hidden = list.length !== 0;
  els.grid.innerHTML = list.map(cardHtml).join("");

  // Attach ONE delegated click listener on the grid, once, instead of one
  // listener per card on every render — this was being re-created for up
  // to ~1,944 buttons on every single render() call, adding real overhead
  // on top of the DOM rebuild itself.
  if (!gridListenerAttached) {
    els.grid.addEventListener("click", (e) => {
      const btn = e.target.closest(".pull-button");
      if (btn) togglePull(Number(btn.dataset.id));
    });
    gridListenerAttached = true;
  }

  renderShortlist();
}

function cardHtml(s) {
  const pulled = shortlistIds.has(s.id);
  return `
    <article class="uni-card">
      <div class="uni-card-head">
        ${avatarHtml(s, "uni-card-avatar")}
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
  const chips = shown
    .map(
      (p) =>
        `<span class="major-chip${p.coreStem ? " major-chip-stem" : ""}">${escapeHtml(p.title)}${p.coreStem ? ' <span class="stem-badge" title="STEM OPT eligible — core CIP family (Engineering, Biological Sciences, Math/Statistics, or Physical Sciences)">STEM</span>' : ""}</span>`
    )
    .join("");
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

  // Update just this one card's button in place — no need to rebuild the
  // entire grid (potentially ~1,944 cards) for a single toggle. This was
  // the actual source of the lag: every pull was re-rendering everything.
  const btn = els.grid.querySelector(`.pull-button[data-id="${id}"]`);
  if (btn) {
    const pulled = shortlistIds.has(id);
    btn.classList.toggle("pulled", pulled);
    btn.textContent = pulled ? "✓ On shortlist" : "+ Pull card";
  }

  renderShortlist();
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
    s.medianEarnings10yr ?? "", (s.topPrograms || []).map((p) => p.title + (p.coreStem ? " (STEM OPT eligible)" : "")).join("; "), s.url ?? "",
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

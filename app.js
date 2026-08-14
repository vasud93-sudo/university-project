const STORAGE_KEY = "uni-catalog-shortlist";

let schools = [];
let shortlistIds = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));

const els = {
  search: document.getElementById("f-search"),
  state: document.getElementById("f-state"),
  ownership: document.getElementById("f-ownership"),
  tuition: document.getElementById("f-tuition"),
  admit: document.getElementById("f-admit"),
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

const fmtMoney = (n) => (n == null ? "—" : `$${Number(n).toLocaleString()}`);
const fmtPct = (n) => (n == null ? "—" : `${Math.round(n * 100)}%`);
const fmtInt = (n) => (n == null ? "—" : Number(n).toLocaleString());

async function init() {
  const res = await fetch("data/schools.json");
  schools = await res.json();
  populateStateFilter();
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

function bindEvents() {
  [els.search, els.state, els.ownership, els.tuition, els.admit, els.sort].forEach((el) =>
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
  const ownership = els.ownership.value;
  const maxTuition = els.tuition.value ? Number(els.tuition.value) : null;
  const minAdmit = els.admit.value ? Number(els.admit.value) : null;

  let list = schools.filter((s) => {
    if (q && !`${s.name} ${s.city}`.toLowerCase().includes(q)) return false;
    if (state && s.state !== state) return false;
    if (ownership && s.ownership !== ownership) return false;
    if (maxTuition != null && (s.tuitionOutOfState == null || s.tuitionOutOfState > maxTuition)) return false;
    if (minAdmit != null && (s.admissionRate == null || s.admissionRate < minAdmit)) return false;
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

function cardHtml(s) {
  const pulled = shortlistIds.has(s.id);
  return `
    <article class="uni-card">
      <div class="uni-card-head">
        <span class="uni-card-tag">${s.ownership}</span>
        <h3 class="uni-card-name">${s.name}</h3>
        <span class="uni-card-loc">${s.city}, ${s.state}</span>
      </div>
      <div class="uni-card-stats">
        <div><span class="stat-label">Tuition (out-of-state)</span><span class="stat-value">${fmtMoney(s.tuitionOutOfState)}</span></div>
        <div><span class="stat-label">Admission rate</span><span class="stat-value">${fmtPct(s.admissionRate)}</span></div>
        <div><span class="stat-label">4-yr grad rate</span><span class="stat-value">${fmtPct(s.gradRate4yr)}</span></div>
        <div><span class="stat-label">Median earnings (10yr)</span><span class="stat-value">${fmtMoney(s.medianEarnings10yr)}</span></div>
        <div><span class="stat-label">Enrollment</span><span class="stat-value">${fmtInt(s.enrollment)}</span></div>
      </div>
      <div class="uni-card-foot">
        <a class="uni-card-link" href="https://${s.url}" target="_blank" rel="noopener">${s.url || ""}</a>
        <button class="pull-button ${pulled ? "pulled" : ""}" data-id="${s.id}">
          ${pulled ? "✓ On shortlist" : "+ Pull card"}
        </button>
      </div>
    </article>
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
        <span>${s.name}</span>
        <button aria-label="Remove ${s.name}" data-id="${s.id}">×</button>
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
    "Admission rate", "Enrollment", "4yr Grad rate", "Median earnings (10yr)", "URL",
  ];
  const rows = items.map((s) => [
    s.name, s.city, s.state, s.ownership,
    s.tuitionInState ?? "", s.tuitionOutOfState ?? "",
    s.admissionRate ?? "", s.enrollment ?? "", s.gradRate4yr ?? "",
    s.medianEarnings10yr ?? "", s.url ?? "",
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

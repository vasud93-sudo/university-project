const params = new URLSearchParams(window.location.search);
const schoolId = Number(params.get("id"));

const fmtMoney = (n) => (n == null ? "—" : `$${Number(n).toLocaleString()}`);
const fmtPct = (n) => (n == null ? "—" : `${Math.round(n * 100)}%`);
const fmtInt = (n) => (n == null ? "—" : Number(n).toLocaleString());

let cdsRecord = null;
let activeTest = "sat";

async function init() {
  const [schools, cds] = await Promise.all([
    fetch("data/schools.json").then((r) => r.json()),
    fetch("data/cds.json").then((r) => r.json()).catch(() => ({})),
  ]);

  const school = schools.find((s) => s.id === schoolId);
  if (!school) {
    document.getElementById("school-name").textContent = "School not found";
    return;
  }

  cdsRecord = cds[schoolId] || null;

  renderHeader(school);
  renderScorecard(school);

  if (cdsRecord && cdsRecord.hasCdsData) {
    renderInternational(cdsRecord);
    renderAdmissionStrategy(cdsRecord);
    renderComparator(cdsRecord);
  } else {
    document.getElementById("no-cds-section").hidden = false;
  }
}

function renderInternational(cds) {
  const section = document.getElementById("international-section");
  const stats = [];

  if (cds.internationalEnrollmentPct != null) {
    stats.push(["International students enrolled", `${cds.internationalEnrollmentPct}%`]);
  }
  if (cds.meritAid) {
    stats.push(["First-years getting merit aid", fmtPct(cds.meritAid.recipientShare)]);
    stats.push(["Average merit award", fmtMoney(cds.meritAid.avgAward)]);
  }

  if (stats.length === 0) {
    section.hidden = true;
    return;
  }

  document.getElementById("international-stats").innerHTML = stats
    .map(([label, value]) => `
      <div class="detail-stat">
        <span class="stat-label">${label}</span>
        <span class="stat-value">${value}</span>
      </div>`)
    .join("");

  const notes = [];
  if (cds.internationalEnrollmentPct == null) notes.push("International enrollment share not reported.");
  if (!cds.meritAid) notes.push("Merit aid is typically the main aid pathway open to international students, since need-based federal aid requires US citizenship or eligible noncitizen status — no merit aid data was found for this school.");
  document.getElementById("international-note").textContent = notes.join(" ") || "";

  section.hidden = false;
}

function renderHeader(s) {
  document.title = `${s.name} — US University Catalog`;
  document.getElementById("school-name").textContent = s.name;
  document.getElementById("school-loc").textContent = `${s.city}, ${s.state} · ${s.ownership}`;
  document.getElementById("school-avatar-slot").innerHTML = avatarHtml(s, "school-avatar");
}

function renderScorecard(s) {
  const stats = [
    ["Tuition (out-of-state)", fmtMoney(s.tuitionOutOfState)],
    ["Admission rate", fmtPct(s.admissionRate)],
    ["4-yr grad rate", fmtPct(s.gradRate4yr)],
    ["Median earnings (10yr)", fmtMoney(s.medianEarnings10yr)],
    ["Enrollment", fmtInt(s.enrollment)],
  ];
  document.getElementById("scorecard-stats").innerHTML = stats
    .map(([label, value]) => `
      <div class="detail-stat">
        <span class="stat-label">${label}</span>
        <span class="stat-value">${value}</span>
      </div>`)
    .join("");

  document.getElementById("scorecard-caveat").textContent =
    "Earnings figures are drawn from federal financial-aid records. International students generally aren't part of this underlying data, so this number may not reflect outcomes for someone in your situation. See our Methodology page for more.";
}

function renderAdmissionStrategy(cds) {
  const section = document.getElementById("admission-strategy-section");
  const badges = [];

  if (cds.edOffered === true) badges.push("Early Decision offered");
  if (cds.eaOffered === true) badges.push("Early Action offered");
  if (cds.edOffered === false && cds.eaOffered === false) badges.push("No ED or EA");
  if (cds.waitlistOffered != null) badges.push(`Waitlist: ${fmtInt(cds.waitlistOffered)} offered`);

  if (badges.length === 0) {
    section.hidden = true;
    return;
  }

  document.getElementById("admission-badges").innerHTML = badges
    .map((b) => `<span class="admission-badge">${b}</span>`)
    .join("");

  const sourceEl = document.getElementById("admission-source");
  const sourceLabel = `Source: ${cds.sourceName || "school-published Common Data Set"}`;
  sourceEl.innerHTML = cds.cdsDocumentUrl
    ? `${escapeHtml(sourceLabel)} — <a href="${encodeURI(cds.cdsDocumentUrl)}" target="_blank" rel="noopener">view original document</a>`
    : escapeHtml(sourceLabel);

  section.hidden = false;
}

function renderComparator(cds) {
  const hasSat = cds.satComposite25 != null && cds.satComposite75 != null;
  const hasAct = cds.actComposite25 != null && cds.actComposite75 != null;
  if (!hasSat && !hasAct) return;

  document.getElementById("comparator-section").hidden = false;

  const toggleBtns = document.querySelectorAll(".toggle-btn");
  toggleBtns.forEach((btn) => {
    btn.disabled = btn.dataset.test === "sat" ? !hasSat : !hasAct;
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      activeTest = btn.dataset.test;
      toggleBtns.forEach((b) => b.classList.toggle("active", b === btn));
      setupComparator();
    });
  });

  activeTest = hasSat ? "sat" : "act";
  toggleBtns.forEach((b) => b.classList.toggle("active", b.dataset.test === activeTest));
  setupComparator();
}

function setupComparator() {
  const ranges = {
    sat: { min: 400, max: 1600, step: 10, p25: cdsRecord.satComposite25, p50: cdsRecord.satComposite50, p75: cdsRecord.satComposite75, label: "SAT" },
    act: { min: 1, max: 36, step: 1, p25: cdsRecord.actComposite25, p50: cdsRecord.actComposite50, p75: cdsRecord.actComposite75, label: "ACT" },
  };
  const r = ranges[activeTest];
  const input = document.getElementById("score-input");
  const output = document.getElementById("score-output");
  const fill = document.getElementById("range-fill");
  const marker = document.getElementById("range-marker");
  const labels = document.getElementById("range-labels");
  const verdict = document.getElementById("comparator-verdict");

  input.min = r.min;
  input.max = r.max;
  input.step = r.step;
  input.value = r.p50 ?? Math.round((r.p25 + r.p75) / 2);
  document.querySelector('label[for="score-input"]').textContent = `Your ${r.label} score`;

  const pct = (v) => ((v - r.min) / (r.max - r.min)) * 100;

  function render() {
    const v = Number(input.value);
    output.textContent = v;
    const p25pct = pct(r.p25);
    const p75pct = pct(r.p75);
    fill.style.left = `${p25pct}%`;
    fill.style.width = `${p75pct - p25pct}%`;
    marker.style.left = `${pct(v)}%`;
    labels.innerHTML = `<span>${r.min}</span><span>Middle 50%: ${r.p25}&ndash;${r.p75}</span><span>${r.max}</span>`;

    let msg;
    if (v < r.p25) {
      msg = `Below the middle 50% of admitted students (${r.p25}&ndash;${r.p75}). Test-optional or a stronger overall profile could help offset this.`;
    } else if (r.p50 != null && v < r.p50) {
      msg = `In the lower half of the middle 50% of admitted students — a solid, competitive score.`;
    } else if (v <= r.p75) {
      msg = `In the upper half of the middle 50% of admitted students — a strong, competitive score.`;
    } else {
      msg = `Above the middle 50% of admitted students (${r.p25}&ndash;${r.p75}) — a standout score for this school.`;
    }
    verdict.innerHTML = msg;
  }

  input.oninput = render;
  render();
}

init();

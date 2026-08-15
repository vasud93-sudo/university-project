const STORAGE_KEY = "uni-catalog-shortlist";

const fmtMoney = (n) => (n == null ? "—" : `$${Number(n).toLocaleString()}`);
const fmtPct = (n) => (n == null ? "—" : `${Math.round(n * 100)}%`);
const fmtInt = (n) => (n == null ? "—" : Number(n).toLocaleString());

async function init() {
  const shortlistIds = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));

  if (shortlistIds.size === 0) {
    document.getElementById("compare-empty").hidden = false;
    document.getElementById("compare-table-wrap").hidden = true;
    return;
  }

  const [schools, cds] = await Promise.all([
    fetch("data/schools.json").then((r) => r.json()),
    fetch("data/cds.json").then((r) => r.json()).catch(() => ({})),
  ]);

  const shortlisted = schools.filter((s) => shortlistIds.has(s.id));
  document.getElementById("compare-subtitle").textContent =
    `Comparing ${shortlisted.length} school${shortlisted.length === 1 ? "" : "s"} from your shortlist.`;

  renderTable(shortlisted, cds);
}

function stemCount(topPrograms) {
  return (topPrograms || []).filter((p) => p.coreStem).length;
}

function renderTable(schoolList, cds) {
  const rows = [
    { label: "", render: (s) => `<div class="compare-avatar-name">${avatarHtml(s, "compare-avatar")}<span>${escapeHtml(s.name)}</span></div>` },
    { label: "Location", render: (s) => `${escapeHtml(s.city)}, ${escapeHtml(s.state)}` },
    { label: "Type", render: (s) => escapeHtml(s.ownership) },
    { label: "Tuition (out-of-state)", render: (s) => fmtMoney(s.tuitionOutOfState) },
    { label: "Admission rate", render: (s) => fmtPct(s.admissionRate) },
    { label: "4-yr grad rate", render: (s) => fmtPct(s.gradRate4yr) },
    { label: "Median earnings (10yr)", render: (s) => fmtMoney(s.medianEarnings10yr) },
    { label: "Enrollment", render: (s) => fmtInt(s.enrollment) },
    { label: "SAT range (25th\u201375th)", render: (s) => {
        const c = cds[s.id];
        if (!c || !c.hasCdsData || c.satComposite25 == null) return "—";
        return `${c.satComposite25}\u2013${c.satComposite75}`;
      } },
    { label: "International students", render: (s) => {
        const c = cds[s.id];
        return c && c.internationalEnrollmentPct != null ? `${c.internationalEnrollmentPct}%` : "—";
      } },
    { label: "Merit aid recipients", render: (s) => {
        const c = cds[s.id];
        return c && c.meritAid ? fmtPct(c.meritAid.recipientShare) : "—";
      } },
    { label: "STEM OPT-eligible majors", render: (s) => {
        const n = stemCount(s.topPrograms);
        return n > 0 ? `${n} of top ${s.topPrograms.length}` : "None flagged";
      } },
    { label: "Top majors", render: (s) => (s.topPrograms || []).slice(0, 5).map((p) => escapeHtml(p.title)).join(", ") || "—" },
    { label: "", render: (s) => `<a class="details-link" href="school.html?id=${encodeURIComponent(s.id)}">View details &rarr;</a>` },
  ];

  const table = document.getElementById("compare-table");
  table.innerHTML = `
    <thead>
      <tr>
        <th class="compare-row-label"></th>
        ${schoolList.map(() => `<th></th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row) => `
        <tr>
          <td class="compare-row-label">${escapeHtml(row.label)}</td>
          ${schoolList.map((s) => `<td>${row.render(s)}</td>`).join("")}
        </tr>`
        )
        .join("")}
    </tbody>
  `;
}

init();

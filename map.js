const STORAGE_KEY = "uni-catalog-shortlist";

const fmtMoney = (n) => (n == null ? "—" : `$${Number(n).toLocaleString()}`);
const fmtPct = (n) => (n == null ? "—" : `${Math.round(n * 100)}%`);

async function init() {
  const shortlistIds = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));

  if (shortlistIds.size === 0) {
    document.getElementById("map-empty").hidden = false;
    return;
  }

  const schools = await fetch("data/schools.json").then((r) => r.json());
  const shortlisted = schools.filter((s) => shortlistIds.has(s.id) && s.lat != null && s.lon != null);
  const missingCoords = schools.filter((s) => shortlistIds.has(s.id) && (s.lat == null || s.lon == null));

  document.getElementById("map-subtitle").textContent =
    `${shortlisted.length} school${shortlisted.length === 1 ? "" : "s"} on your shortlist` +
    (missingCoords.length > 0 ? ` (${missingCoords.length} without location data yet)` : "");

  if (shortlisted.length === 0) {
    document.getElementById("map-empty").hidden = false;
    document.querySelector("#map-empty p").textContent =
      "None of your shortlisted schools have location data yet — try refreshing your data.";
    return;
  }

  const map = L.map("map", { scrollWheelZoom: true });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18,
  }).addTo(map);

  const markers = shortlisted.map((s) => {
    const marker = L.marker([s.lat, s.lon]).addTo(map);
    marker.bindPopup(`
      <div class="map-popup-name">${s.name}</div>
      <div class="map-popup-meta">${s.city}, ${s.state}</div>
      <div class="map-popup-meta">Tuition: ${fmtMoney(s.tuitionOutOfState)} · Admit rate: ${fmtPct(s.admissionRate)}</div>
      <a class="map-popup-link" href="school.html?id=${s.id}">View details &rarr;</a>
    `);
    return marker;
  });

  if (markers.length === 1) {
    map.setView([shortlisted[0].lat, shortlisted[0].lon], 10);
  } else {
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.2));
  }
}

init();

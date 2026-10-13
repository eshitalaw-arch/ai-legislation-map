// ============================
// US AI Legislation Map (Leaflet)
// No-server mode: data comes from ./data/hubs.js as window.HUBS
// Hover popup stays open long enough to click links
// ============================

// 1) Create map
const map = L.map("map", { zoomControl: true }).setView([39.5, -98.35], 4);

// 2) Tiles
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// 3) UI controls
const sectorEl = document.getElementById("sectorFilter");
const statusEls = Array.from(document.querySelectorAll(".statusFilter"));
const countEl = document.getElementById("count");

// 4) Data + layers
let allFeatures = [];
let layerGroup = L.layerGroup().addTo(map);

function selectedStatuses() {
  return new Set(statusEls.filter(x => x.checked).map(x => x.value));
}

function passesFilters(props) {
  const sector = sectorEl.value;
  const statuses = selectedStatuses();
  const okSector = (sector === "all") || (props.sector === sector);
  const okStatus = statuses.has(props.status);
  return okSector && okStatus;
}

const STATUS_COLORS = { passed: "#1b7f3b", pending: "#d97706", guidance: "#2563eb" };
const STATUS_LABELS = { passed: "Passed", pending: "Pending", guidance: "Guidance" };
const SECTOR_LABELS = {
  healthcare: "Healthcare",
  employment: "Employment",
  biometrics: "Biometrics",
  synthetic_media: "Synthetic media",
  consumer_transparency: "Consumer transparency",
  chatbots: "Chatbots & AI companions",
  comprehensive: "Comprehensive / algorithmic discrimination",
  frontier_models: "Frontier AI safety",
  government: "Government use of AI"
};

function markerStyle(props) {
  const fill = STATUS_COLORS[props.status] || "#555";
  return { radius: 7, weight: 1.5, color: "#fff", fillColor: fill, fillOpacity: 0.95 };
}

function popupHTML(p) {
  const safe = (x) => (x ?? "").toString()
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const sourceLink = p.source_url
    ? `<div style="margin-top:6px;">
         <a href="${safe(p.source_url)}" target="_blank" rel="noopener">
           ${safe(p.source_title || "Official source")}
         </a>
       </div>`
    : "";

  const analysisLink = p.analysis_url
    ? `<div>
         <a href="${safe(p.analysis_url)}" target="_blank" rel="noopener">
           ${safe(p.analysis_title || "Analysis")}
         </a>
       </div>`
    : "";

  return `
    <div class="popup">
      <h3>${safe(p.title || "AI policy hub")}</h3>
      <div class="meta">
        <div><strong>${safe(p.state || "")}</strong></div>
        <div>Status: ${safe(STATUS_LABELS[p.status] || p.status || "—")} · Sector: ${safe(SECTOR_LABELS[p.sector] || p.sector || "—")} · Updated: ${safe(p.last_updated || "—")}</div>
      </div>
      <div>${safe(p.summary || "")}</div>
      ${sourceLink}
      ${analysisLink}
    </div>
  `;
}

function attachHoverPopupBehavior(marker) {
  let closeTimer = null;

  function scheduleClose() {
    closeTimer = setTimeout(() => marker.closePopup(), 180);
  }

  function cancelClose() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  }

  marker.on("mouseover", () => {
    cancelClose();
    marker.openPopup();
  });

  marker.on("mouseout", () => {
    scheduleClose();
  });

  marker.on("popupopen", (e) => {
    const el = e.popup.getElement();
    if (!el) return;

    // bind once
    if (el.dataset.hoverBound === "1") return;
    el.dataset.hoverBound = "1";

    el.addEventListener("mouseenter", cancelClose);
    el.addEventListener("mouseleave", scheduleClose);
  });
}

function render() {
  layerGroup.clearLayers();

  const filtered = allFeatures.filter(f => {
    const c = f.geometry && f.geometry.coordinates;
    return c && c.length === 2 && passesFilters(f.properties || {});
  });

  // Group entries that share a location so they can be fanned out in a ring
  const groups = new Map();
  filtered.forEach(f => {
    const key = f.geometry.coordinates.join(",");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  });

  const zoom = map.getZoom();
  const placed = [];
  groups.forEach(list => {
    const [lng, lat] = list[0].geometry.coordinates;
    if (list.length === 1) { placed.push([list[0], [lat, lng]]); return; }
    const center = map.project([lat, lng], zoom);
    const radiusPx = 9 + list.length * 2.5;
    list.forEach((f, i) => {
      const angle = (2 * Math.PI * i) / list.length - Math.PI / 2;
      const pt = L.point(center.x + radiusPx * Math.cos(angle), center.y + radiusPx * Math.sin(angle));
      const ll = map.unproject(pt, zoom);
      placed.push([f, [ll.lat, ll.lng]]);
    });
  });

  placed.forEach(([f, latlng]) => {
    const p = f.properties || {};

    const marker = L.circleMarker(latlng, markerStyle(p));

    marker.bindPopup(popupHTML(p), {
      maxWidth: 320,
      closeButton: true,
      autoPan: true,
      closeOnClick: true
    });

    attachHoverPopupBehavior(marker);
    marker.addTo(layerGroup);
  });

  if (countEl) countEl.textContent = `${filtered.length} entries shown`;
}

// Re-fan clustered markers when zoom changes so rings keep a constant on-screen size
map.on("zoomend", render);

// Load hubs from window.HUBS
const fc = window.HUBS;
allFeatures = (fc && Array.isArray(fc.features)) ? fc.features : [];
render();

// React to filter changes
if (sectorEl) sectorEl.addEventListener("change", render);
statusEls.forEach(el => el.addEventListener("change", render));
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

function markerStyle(props) {
  const byStatus = {
    passed:   { radius: 7, fillOpacity: 0.95 },
    pending:  { radius: 6, fillOpacity: 0.90 },
    guidance: { radius: 6, fillOpacity: 0.75 }
  };
  return Object.assign(
    { weight: 1, color: "#111", fillColor: "#111" },
    byStatus[props.status] || { radius: 6, fillOpacity: 0.85 }
  );
}

function popupHTML(p) {
  const safe = (x) => (x ?? "").toString();

  // Use target=_self for local file:// reliability. Once you publish, you can switch to _blank.
  const sourceLink = p.source_url
    ? `<div style="margin-top:6px;">
         <a href="${safe(p.source_url)}" target="_self" rel="noopener">
           ${safe(p.source_title || "Official source")}
         </a>
       </div>`
    : "";

  const analysisLink = p.analysis_url
    ? `<div>
         <a href="${safe(p.analysis_url)}" target="_self" rel="noopener">
           ${safe(p.analysis_title || "Analysis")}
         </a>
       </div>`
    : "";

  return `
    <div class="popup">
      <h3>${safe(p.title || "AI policy hub")}</h3>
      <div class="meta">
        <div><strong>${safe(p.state || "")}</strong></div>
        <div>Status: ${safe(p.status || "—")} · Sector: ${safe(p.sector || "—")} · Updated: ${safe(p.last_updated || "—")}</div>
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

  const filtered = allFeatures.filter(f => passesFilters(f.properties || {}));

  filtered.forEach(f => {
    const coords = f.geometry && f.geometry.coordinates;
    if (!coords || coords.length !== 2) return;

    const [lng, lat] = coords;
    const p = f.properties || {};

    const marker = L.circleMarker([lat, lng], markerStyle(p));

    marker.bindPopup(popupHTML(p), {
      closeButton: true,
      autoPan: true,
      closeOnClick: true
    });

    attachHoverPopupBehavior(marker);
    marker.addTo(layerGroup);
  });

  if (countEl) countEl.textContent = `${filtered.length} hubs shown`;
}

// Load hubs from window.HUBS
const fc = window.HUBS;
allFeatures = (fc && Array.isArray(fc.features)) ? fc.features : [];
render();

// React to filter changes
if (sectorEl) sectorEl.addEventListener("change", render);
statusEls.forEach(el => el.addEventListener("change", render));
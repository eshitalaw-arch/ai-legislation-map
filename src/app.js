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
const subcatEl = document.getElementById("subcatFilter");
const subcatWrap = document.getElementById("subcatWrap");
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
  const okSector = (sector === "all") || (props.sector === sector) || isAlso(props, sector);
  const okSubcat = sector !== "workforce" || !subcatEl || subcatEl.value === "all" || workforceSubcat(props) === subcatEl.value;
  const okStatus = statuses.has(props.status);
  return okSector && okSubcat && okStatus;
}

const STATUS_COLORS = { passed: "#1b7f3b", pending: "#d97706", guidance: "#2563eb" };
const STATUS_LABELS = { passed: "Passed", pending: "Pending", guidance: "Guidance" };
const SECTOR_LABELS = {
  healthcare: "Healthcare",
  workforce: "AI and Workforce Impact",
  biometrics: "Biometrics",
  synthetic_media: "Synthetic media",
  consumer_transparency: "Consumer transparency",
  chatbots: "Chatbots & AI companions",
  comprehensive: "Comprehensive / algorithmic discrimination",
  frontier_models: "Frontier AI safety",
  government: "Government use of AI"
};

const SUBCAT_LABELS = {
  decisions: "Employment decisions & worker protections",
  displacement: "Displacement & employer notification",
  reskilling: "Reskilling & transition",
  studies: "Studies & planning"
};

// Some entries are cross-listed in a second sector, e.g. also = "workforce:decisions"
function isAlso(p, sector) { return !!p.also && p.also.split(":")[0] === sector; }
function workforceSubcat(p) { return p.sector === "workforce" ? p.subcategory : (isAlso(p, "workforce") ? p.also.split(":")[1] : ""); }

function sectorText(p) {
  const base = SECTOR_LABELS[p.sector] || p.sector || "—";
  let txt = p.subcategory && SUBCAT_LABELS[p.subcategory] ? `${base} › ${SUBCAT_LABELS[p.subcategory]}` : base;
  if (p.also) {
    const [sec, sub] = p.also.split(":");
    txt += `; also ${SECTOR_LABELS[sec] || sec}${sub && SUBCAT_LABELS[sub] ? " › " + SUBCAT_LABELS[sub] : ""}`;
  }
  return txt;
}

const safe = (x) => (x ?? "").toString()
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function markerStyle(props) {
  const fill = STATUS_COLORS[props.status] || "#555";
  return { radius: 7, weight: 1.5, color: "#fff", fillColor: fill, fillOpacity: 0.95 };
}

function popupHTML(p) {
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
        <div>Status: ${safe(STATUS_LABELS[p.status] || p.status || "—")} · Sector: ${safe(sectorText(p))} · Updated: ${safe(p.last_updated || "—")}</div>
      </div>
      <div>${safe(p.summary || "")}</div>
      ${sourceLink}
      ${analysisLink}
      <a href="#" class="profile-link" data-state="${safe(p.state)}">${safe(p.state)} state profile →</a>
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
if (sectorEl) sectorEl.addEventListener("change", () => {
  if (subcatWrap) subcatWrap.hidden = sectorEl.value !== "workforce";
  syncChromeHeights();
  render();
});
if (subcatEl) subcatEl.addEventListener("change", render);
statusEls.forEach(el => el.addEventListener("change", render));

// About & sources panel
const aboutPanel = document.getElementById("aboutPanel");
document.querySelectorAll(".about-open").forEach(a =>
  a.addEventListener("click", e => { e.preventDefault(); aboutPanel.hidden = false; }));
document.getElementById("aboutClose")?.addEventListener("click", () => { aboutPanel.hidden = true; });

// ============================
// Job-risk context (Tufts Digital Planet) + state profiles
// ============================
const RISK = window.JOB_RISK || null;
const riskToggle = document.getElementById("riskToggle");
const riskScale = document.getElementById("riskScale");
const pct = (x) => (x == null ? "—" : (Math.round(x * 1000) / 10).toFixed(1) + "%");

// Keep floating panels clear of the header and footer, whose heights change with wrapping
function syncChromeHeights() {
  const h = document.querySelector(".topbar")?.offsetHeight || 74;
  const f = document.querySelector(".footer")?.offsetHeight || 36;
  document.documentElement.style.setProperty("--header-h", h + "px");
  document.documentElement.style.setProperty("--footer-h", f + "px");
  map.invalidateSize();
}
window.addEventListener("resize", syncChromeHeights);
syncChromeHeights();
const num = (x) => (x == null ? "—" : Math.round(x).toLocaleString("en-US"));

function riskColor(v) {
  // Sequential purple scale between the 50-state min and max
  const stops = ["#efedf5", "#bcbddc", "#807dba", "#54278f"];
  if (!RISK || v == null) return "#ccc";
  const t = Math.max(0, Math.min(1, (v - RISK.min_pct) / (RISK.max_pct - RISK.min_pct)));
  const i = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
  const local = t * (stops.length - 1) - i;
  const a = stops[i].match(/\w\w/g).map(h => parseInt(h, 16));
  const b = stops[i + 1].match(/\w\w/g).map(h => parseInt(h, 16));
  return "#" + a.map((c, k) => Math.round(c + (b[k] - c) * local).toString(16).padStart(2, "0")).join("");
}

map.createPane("statesPane");
map.getPane("statesPane").style.zIndex = 350; // below markers (overlayPane = 400)

let statesLayer = null;
function stateStyle(feature) {
  const name = feature.properties.name;
  const r = RISK && RISK.states[name];
  const on = riskToggle && riskToggle.checked;
  return {
    pane: "statesPane",
    weight: on ? 0.8 : 0.5,
    color: on ? "#fff" : "#9a9a9a",
    opacity: on ? 1 : 0.35,
    fillColor: r ? riskColor(r.pct_median) : "#ccc",
    fillOpacity: on ? 0.72 : 0
  };
}

if (window.topojson && window.US_STATES_TOPO) {
  const geo = topojson.feature(window.US_STATES_TOPO, window.US_STATES_TOPO.objects.states);
  statesLayer = L.geoJSON(geo, {
    pane: "statesPane",
    style: stateStyle,
    onEachFeature: (f, layer) => {
      layer.on("click", () => openProfile(f.properties.name));
      layer.on("mouseover", () => layer.setStyle({ weight: 2, color: "#54278f", opacity: 0.9 }));
      layer.on("mouseout", () => statesLayer.resetStyle(layer));
      const r = RISK && RISK.states[f.properties.name];
      layer.bindTooltip(
        `<strong>${safe(f.properties.name)}</strong>` + (r ? `<br>${pct(r.pct_median)} of jobs at risk (Tufts, median scenario)` : "") +
        `<br><span style="opacity:.7">Click for state profile</span>`,
        { sticky: true, direction: "top", opacity: 0.95 });
    }
  }).addTo(map);
}

if (RISK) {
  document.getElementById("riskMin").textContent = pct(RISK.min_pct);
  document.getElementById("riskMax").textContent = pct(RISK.max_pct);
}
riskToggle?.addEventListener("change", () => {
  if (riskScale) riskScale.hidden = !riskToggle.checked;
  statesLayer?.setStyle(stateStyle);
  syncChromeHeights();
});

// State profile panel
const profileEl = document.getElementById("profile");
const profileBody = document.getElementById("profileBody");
document.getElementById("profileClose")?.addEventListener("click", () => { profileEl.hidden = true; });
document.addEventListener("click", e => {
  const a = e.target.closest && e.target.closest(".profile-link");
  if (a) { e.preventDefault(); map.closePopup(); openProfile(a.dataset.state); }
});

function billHTML(p) {
  return `<div class="bill">
    <div><span class="pill ${safe(p.status)}">${safe(STATUS_LABELS[p.status] || p.status)}</span><span class="bill-title">${safe(p.title.replace(/^[^–]+–\s*/, ""))}</span></div>
    <div class="note" style="margin-top:2px">${safe(sectorText(p))}</div>
    <div style="margin-top:4px">${safe(p.summary)}</div>
    <div style="margin-top:4px"><a href="${safe(p.source_url)}" target="_blank" rel="noopener">${safe(p.source_title || "Official source")}</a>${
      p.analysis_url ? ` · <a href="${safe(p.analysis_url)}" target="_blank" rel="noopener">${safe(p.analysis_title || "Analysis")}</a>` : ""}</div>
  </div>`;
}

function openProfile(name) {
  if (!profileEl || !name) return;
  const r = RISK && RISK.states[name];
  const entries = allFeatures.map(f => f.properties).filter(p => p.state === name);
  const order = { passed: 0, pending: 1, guidance: 2 };
  const isWf = p => p.sector === "workforce" || isAlso(p, "workforce");
  const workforce = entries.filter(isWf).sort((a, b) => order[a.status] - order[b.status]);
  const other = entries.filter(p => !isWf(p)).sort((a, b) => order[a.status] - order[b.status]);

  let exposure = `<p class="note">No Tufts Digital Planet figures are available for this jurisdiction.</p>`;
  if (r) {
    const regions = (r.regions || []).map(g => `<li>${safe(g.name)}: ${pct(g.pct_median)}</li>`).join("");
    exposure = `
      <div class="big">${pct(r.pct_median)}</div>
      <div>of jobs at risk from AI in the study's median scenario (about ${num(r.jobs_median)} jobs)${r.rank_of_50 ? `; ${r.rank_of_50} of 50 states` : ""}.</div>
      <p class="note">Range across the study's scenarios: ${pct(r.pct_slow)} (slowest adoption) to ${pct(r.pct_fast)} (fastest). Tufts exposure score: ${safe(r.exposure_score)}.</p>
      ${regions ? `<h3>Most at-risk metro areas</h3><ul>${regions}</ul>` : ""}
      <h3>At-risk industries</h3>
      <p class="note" style="margin-top:0">Tufts does not publish industry figures by state. Nationally, the industries with the highest share of jobs at risk (median scenario) are:</p>
      <ul>${RISK.national_sectors_top.map(x => `<li>${safe(x.name)}: ${pct(x.pct_median)}</li>`).join("")}</ul>
      <p class="note">Source: ${safe(RISK.citation)} <a href="${safe(RISK.source_url)}" target="_blank" rel="noopener">View study</a>. Projections, not forecasts of actual job losses.</p>`;
  }

  const section = (title, list, empty) => `<h3>${title} (${list.length})</h3>` +
    (list.length ? list.map(billHTML).join("") : `<p class="note">${empty}</p>`);

  profileBody.innerHTML = `
    <h2>${safe(name)}</h2>
    <div class="note" style="margin-top:0">State profile · current as of Oct 13, 2026</div>
    <h3>AI job-risk exposure</h3>
    ${exposure}
    ${section("AI and workforce measures", workforce, "No AI-and-workforce measures on this map for this state.")}
    ${section("Other AI laws, bills and guidance", other, "No other entries on this map for this state.")}
    <div class="caveat"><strong>About this profile.</strong> This profile deliberately gives no "preparedness" score. Legislation is only one part of how a state responds to AI; budgets, workforce and education programs, agency action and private-sector efforts are not captured here, and this map does not list every AI-related bill.</div>`;
  profileEl.hidden = false;
  profileEl.scrollTop = 0;
}

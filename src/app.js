// ============================
// US AI Legislation Map (Leaflet)
// No-server mode: data comes from ./data/hubs.js as window.HUBS
// Hover popup stays open long enough to click links
// ============================

// 1) Create map
const map = L.map("map", { zoomControl: true, zoomSnap: 0.25 });
const US_BOUNDS = [[24.3, -124.8], [49.4, -64.5]];
function fitUS() {
  // Leave room on the right for the Northeast callouts, plus the findings note when it's open on wide screens
  const w = document.getElementById("map").clientWidth;
  const note = document.getElementById("gapNote");
  const noteRoom = note && !note.hidden && !note.classList.contains("collapsed") && w >= 900 ? 340 : 0;
  map.fitBounds(US_BOUNDS, { paddingTopLeft: [6, 6], paddingBottomRight: [(w < 700 ? 44 : 10) + noteRoom, 6] });
}
let lastFit = null;
function fitUSAndRemember() { fitUS(); lastFit = { c: map.getCenter(), z: map.getZoom() }; }
function userHasMovedMap() {
  return !lastFit || map.getZoom() !== lastFit.z || map.getCenter().distanceTo(lastFit.c) > 1000;
}
fitUSAndRemember();

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
let currentProfile = null;   // state whose profile panel is open
let profileShowAll = false;  // profile ignores filters when true
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
  synthetic_media: "Deepfakes & synthetic media",
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

// ----------------------------
// One summary badge per state (count + status ring), instead of one dot per entry
// ----------------------------

// Approximate visual centers [lat, lng] so badges sit inside each state
const STATE_CENTERS = {
  "Alabama": [32.8, -86.8], "Alaska": [64.0, -152.0], "Arizona": [34.3, -111.7], "Arkansas": [34.9, -92.4],
  "California": [37.2, -119.5], "Colorado": [39.0, -105.5], "Connecticut": [41.6, -72.7], "Delaware": [39.0, -75.5],
  "Florida": [28.4, -81.6], "Georgia": [32.7, -83.4], "Hawaii": [20.8, -156.4], "Idaho": [44.0, -114.7],
  "Illinois": [40.0, -89.2], "Indiana": [39.9, -86.3], "Iowa": [42.0, -93.5], "Kansas": [38.5, -98.4],
  "Kentucky": [37.5, -85.3], "Louisiana": [31.0, -92.2], "Maine": [45.3, -69.2], "Maryland": [39.0, -76.8],
  "Massachusetts": [42.3, -71.8], "Michigan": [43.6, -84.7], "Minnesota": [46.3, -94.3], "Mississippi": [32.7, -89.7],
  "Missouri": [38.4, -92.5], "Montana": [47.0, -109.6], "Nebraska": [41.5, -99.8], "Nevada": [39.3, -116.6],
  "New Hampshire": [43.7, -71.6], "New Jersey": [40.1, -74.6], "New Mexico": [34.4, -106.1], "New York": [42.9, -75.5],
  "North Carolina": [35.5, -79.4], "North Dakota": [47.5, -100.5], "Ohio": [40.3, -82.8], "Oklahoma": [35.6, -97.5],
  "Oregon": [43.9, -120.6], "Pennsylvania": [40.9, -77.8], "Rhode Island": [41.7, -71.5], "South Carolina": [33.9, -80.9],
  "South Dakota": [44.4, -100.2], "Tennessee": [35.86, -86.4], "Texas": [31.2, -99.3], "Utah": [39.3, -111.7],
  "Vermont": [44.0, -72.7], "Virginia": [37.5, -78.8], "Washington": [47.4, -120.5], "West Virginia": [38.6, -80.6],
  "Wisconsin": [44.6, -89.9], "Wyoming": [43.0, -107.5]
};

// Small Northeastern states get a labeled callout off the coast at low zoom, so badges don't overlap
const CALLOUT_STATES = ["Vermont", "New Hampshire", "Massachusetts", "Rhode Island", "Connecticut", "New Jersey", "Delaware", "Maryland"];
const CALLOUT_ABBR = { "Vermont": "VT", "New Hampshire": "NH", "Massachusetts": "MA", "Rhode Island": "RI",
  "Connecticut": "CT", "New Jersey": "NJ", "Delaware": "DE", "Maryland": "MD" };
const CALLOUT_MAX_ZOOM = 6;
const ABBR2 = { "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO","Florida":"FL","Georgia":"GA",
  "Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY","Louisiana":"LA","Maine":"ME",
  "Michigan":"MI","Minnesota":"MN","Mississippi":"MS","Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV","New Mexico":"NM",
  "New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK","Oregon":"OR","Pennsylvania":"PA",
  "South Carolina":"SC","South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT","Virginia":"VA","Washington":"WA",
  "West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY" };

function badgeSize(n) {
  const z = map.getZoom();
  if (z < 4) return Math.round(14 + 2.2 * Math.sqrt(n)); // small screens: compact badges
  const scale = z >= 5 ? 1.15 : 1;
  return Math.round((18 + 4 * Math.sqrt(n)) * scale);
}

function badgeIcon(list, label) {
  const n = list.length;
  const c = { passed: 0, pending: 0, guidance: 0 };
  list.forEach(p => { c[p.status] = (c[p.status] || 0) + 1; });
  const a = (c.passed / n) * 100, b = a + (c.pending / n) * 100;
  const ring = `conic-gradient(${STATUS_COLORS.passed} 0 ${a}%, ${STATUS_COLORS.pending} ${a}% ${b}%, ${STATUS_COLORS.guidance} ${b}% 100%)`;
  const size = badgeSize(n);
  const tag = label ? `<span class="badge-abbr">${label}</span>` : "";
  return L.divIcon({
    className: "state-badge-wrap",
    html: `<div class="state-badge" style="width:${size}px;height:${size}px;background:${ring}"><span style="font-size:${Math.max(8.5, Math.min(12, size * 0.42))}px">${n}</span></div>${tag}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

function badgeTooltip(state, list) {
  const c = { passed: 0, pending: 0, guidance: 0 };
  list.forEach(p => { c[p.status]++; });
  const parts = ["passed", "pending", "guidance"].filter(k => c[k])
    .map(k => `<span style="color:${STATUS_COLORS[k]};font-weight:600">${c[k]} ${STATUS_LABELS[k].toLowerCase()}</span>`);
  return `<strong>${safe(state)}</strong><br>${list.length} ${list.length === 1 ? "entry" : "entries"}: ${parts.join(" · ")}` +
    shadeLine(state) +
    `<br><span style="opacity:.7">Click to see them</span>`;
}

function render() {
  layerGroup.clearLayers();

  const filtered = allFeatures.map(f => f.properties || {}).filter(passesFilters);
  const byState = new Map();
  filtered.forEach(p => {
    if (!byState.has(p.state)) byState.set(p.state, []);
    byState.get(p.state).push(p);
  });

  const zoom = map.getZoom();
  const useCallouts = zoom <= CALLOUT_MAX_ZOOM;

  // Callout column: just east of the coast, stacked top-to-bottom without overlapping
  const calloutPos = new Map();
  if (useCallouts) {
    // Keep the column on screen (narrow phones), but never west of the coast
    const pane = map.getPixelBounds();
    const coastX = map.project([41.0, -69.4], zoom).x;
    const colX = Math.max(coastX + 14, Math.min(coastX + 34, pane.max.x - 30));
    let lastBottom = -Infinity;
    CALLOUT_STATES.filter(s => byState.has(s)).forEach(s => {
      const size = badgeSize(byState.get(s).length);
      const ideal = map.project(STATE_CENTERS[s], zoom).y;
      const y = Math.max(ideal, lastBottom + size / 2 + 4);
      lastBottom = y + size / 2;
      calloutPos.set(s, map.unproject(L.point(colX, y), zoom));
    });
  }

  byState.forEach((list, state) => {
    const center = STATE_CENTERS[state];
    if (!center) return;
    const callout = calloutPos.get(state);
    const pos = callout || L.latLng(center);
    if (callout) {
      L.polyline([center, callout], { color: "#777", weight: 1, opacity: 0.8, interactive: false }).addTo(layerGroup);
      L.circleMarker(center, { radius: 2.5, weight: 0, fillColor: "#555", fillOpacity: 0.9, interactive: false }).addTo(layerGroup);
    }
    const marker = L.marker(pos, {
      icon: badgeIcon(list, callout ? CALLOUT_ABBR[state] : ""),
      riseOnHover: true,
      keyboard: true,
      title: `${state}: ${list.length} entries`
    });
    marker.bindTooltip(badgeTooltip(state, list), { direction: "top", offset: [0, -badgeSize(list.length) / 2], opacity: 0.96 });
    marker.on("click", () => openProfile(state));
    marker.addTo(layerGroup);
  });

  if (countEl) {
    countEl.textContent = `${filtered.length} ${filtered.length === 1 ? "entry" : "entries"} in ${byState.size} ${byState.size === 1 ? "state" : "states"}`;
  }
  const panel = document.getElementById("profile");
  if (panel && !panel.hidden && currentProfile) openProfile(currentProfile, { keepScroll: true });
}


// Load entries from window.HUBS (rendered once the rest of the script has loaded)
const fc = window.HUBS;
allFeatures = (fc && Array.isArray(fc.features)) ? fc.features : [];

// React to filter changes
if (sectorEl) sectorEl.addEventListener("change", () => {
  if (subcatWrap) subcatWrap.hidden = sectorEl.value !== "workforce";
  // Keep the red/blue comparison's highlighted topic in step with the sector filter
  const note = document.getElementById("gapNote");
  if (note && !note.hidden) { activeTopic = sectorEl.value === "all" ? null : sectorEl.value; drawFindings(); }
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
const POL = window.POLITICS_2024 || null;
const shadeSelect = document.getElementById("shadeSelect");
const riskScale = document.getElementById("riskScale");
const polScale = document.getElementById("polScale");
const shadeMode = () => (shadeSelect ? shadeSelect.value : "none");
// "R+1.7" / "D+5.9" from a signed margin (Republican positive)
const marginText = (m) => (m == null ? "—" : (m > 0 ? "R+" : "D+") + (Math.abs(m) * 100).toFixed(1));
const pct = (x) => (x == null ? "—" : (Math.round(x * 1000) / 10).toFixed(1) + "%");

// Keep floating panels clear of the header and footer, whose heights change with wrapping
function syncChromeHeights() {
  const h = document.querySelector(".topbar")?.offsetHeight || 74;
  const f = document.querySelector(".footer")?.offsetHeight || 36;
  document.documentElement.style.setProperty("--header-h", h + "px");
  document.documentElement.style.setProperty("--footer-h", f + "px");
  const untouched = !userHasMovedMap();
  map.invalidateSize();
  if (untouched) fitUSAndRemember();
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

function polColor(m) {
  // Diverging blue-white-red scale, capped at a 30-point margin
  if (m == null) return "#ccc";
  const stops = ["#2166ac", "#92c5de", "#f7f7f7", "#f4a582", "#b2182b"];
  const t = (Math.max(-0.3, Math.min(0.3, m)) + 0.3) / 0.6;
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
  const mode = shadeMode();
  const on = mode !== "none";
  let fill = "#ccc";
  if (mode === "risk") { const r = RISK && RISK.states[name]; fill = r ? riskColor(r.pct_median) : "#ccc"; }
  if (mode === "politics") { const v = POL && POL.states[name]; fill = v ? polColor(v.margin) : "#ccc"; }
  if (mode === "redblue") {
    const v = POL && POL.states[name];
    return { pane: "statesPane", weight: 0.8, color: "#fff", opacity: 1,
      fillColor: v ? (v.margin > 0 ? "#f2a7a9" : "#a6c8ea") : "#ececec", fillOpacity: 0.85 };
  }
  return {
    pane: "statesPane",
    weight: on ? 0.8 : 0.5,
    color: on ? "#fff" : "#9a9a9a",
    opacity: on ? 1 : 0.35,
    fillColor: fill,
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
      layer.on("mouseout", () => { statesLayer.resetStyle(layer); });
      layer.bindTooltip(() => `<strong>${safe(f.properties.name)}</strong>` + shadeLine(f.properties.name) +
        `<br><span style="opacity:.7">Click for state profile</span>`,
        { sticky: true, direction: "top", opacity: 0.95 });
    }
  }).addTo(map);
}

if (RISK) {
  document.getElementById("riskMin").textContent = pct(RISK.min_pct);
  document.getElementById("riskMax").textContent = pct(RISK.max_pct);
}
// One line describing the active shading for a state, used in tooltips
function shadeLine(name) {
  const mode = shadeMode();
  if (mode === "risk") {
    const r = RISK && RISK.states[name];
    return r ? `<br>${pct(r.pct_median)} of jobs at risk (Tufts, median scenario)` : "";
  }
  const r = RISK && RISK.states[name], v = POL && POL.states[name];
  const voteLine = v ? `<br>2024 president: <b>${marginText(v.margin)}</b> (Trump ${pct(v.r_pct)}, Harris ${pct(v.d_pct)})` : "";
  if (mode === "politics") return voteLine;
  if (mode === "redblue") return voteLine;
  return "";
}

shadeSelect?.addEventListener("change", () => {
  const mode = shadeMode();
  if (riskScale) riskScale.hidden = mode !== "risk";
  if (polScale) polScale.hidden = mode !== "politics";
  if (gapScale) gapScale.hidden = mode !== "redblue";
  const untouchedBefore = !userHasMovedMap();
  if (gapNote) {
    gapNote.hidden = mode !== "redblue";
    // Start collapsed on phones so the map stays visible
    if (mode === "redblue") { drawFindings(); setGapCollapsed(window.innerWidth < 600); }
    else if (activeTopic) { activeTopic = null; if (sectorEl) { sectorEl.value = "all"; sectorEl.dispatchEvent(new Event("change")); } }
  }
  if (untouchedBefore) fitUSAndRemember();
  statesLayer?.setStyle(stateStyle);
  // Draw highlighted states last so their outlines aren't hidden under neighbors
  syncChromeHeights();
  render();
});

// State profile panel
const profileEl = document.getElementById("profile");
const profileBody = document.getElementById("profileBody");
document.getElementById("profileClose")?.addEventListener("click", () => { profileEl.hidden = true; });
document.getElementById("profileClose")?.addEventListener("click", () => { currentProfile = null; });
profileBody?.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-show-all]");
  if (b) { e.preventDefault(); profileShowAll = b.dataset.showAll === "1"; openProfile(currentProfile, { keepScroll: true }); }
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

function openProfile(name, opts = {}) {
  if (!profileEl || !name) return;
  if (name !== currentProfile) profileShowAll = false;
  currentProfile = name;
  const r = RISK && RISK.states[name];
  const allForState = allFeatures.map(f => f.properties).filter(p => p.state === name);
  const matching = allForState.filter(passesFilters);
  const entries = profileShowAll ? allForState : matching;
  const filterNote = matching.length === allForState.length ? "" :
    (profileShowAll
      ? `<p class="filter-note">Showing all ${allForState.length} entries. <a href="#" data-show-all="0">Show only the ${matching.length} matching your filters</a></p>`
      : `<p class="filter-note">Showing ${matching.length} of ${allForState.length} entries that match your filters. <a href="#" data-show-all="1">Show all</a></p>`);
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
    ${POL && POL.states[name] ? `<p class="pol-line"><span class="pol-chip" style="background:${polColor(POL.states[name].margin)}"></span>2024 presidential vote: <strong>${marginText(POL.states[name].margin)}</strong> (Trump ${pct(POL.states[name].r_pct)}, Harris ${pct(POL.states[name].d_pct)}) <span class="note">· <a href="${safe(POL.source_url)}" target="_blank" rel="noopener">FEC</a></span></p>` : ""}
    ${filterNote}
    ${section("AI and workforce measures", workforce, "None on this map" + (entries === matching && matching.length < allForState.length ? " that match your filters." : "."))}
    ${section("Other AI laws, bills and guidance", other, "None on this map" + (entries === matching && matching.length < allForState.length ? " that match your filters." : "."))}
    <h3>AI job-risk exposure</h3>
    ${exposure}
    <div class="caveat"><strong>About this profile.</strong> This profile deliberately gives no "preparedness" score. Legislation is only one part of how a state responds to AI; budgets, workforce and education programs, agency action and private-sector efforts are not captured here, and this map does not list every AI-related bill.</div>`;
  profileEl.hidden = false;
  if (!opts.keepScroll) profileEl.scrollTop = 0;
}

// Draw once everything above is defined; badge sizes and callout positions depend on zoom
render();
map.on("zoomend", render);

// ============================
// AI response gap: workforce response per state + findings note
// ============================
const gapScale = document.getElementById("gapScale");
const gapNote = document.getElementById("gapNote");
document.getElementById("gapNoteClose")?.addEventListener("click", () => {
  const untouched = !userHasMovedMap();
  gapNote.hidden = true;
  if (untouched) fitUSAndRemember();
});
const gapToggle = document.getElementById("gapNoteToggle");
function setGapCollapsed(c) {
  const untouched = !userHasMovedMap();
  gapNote?.classList.toggle("collapsed", c); gapToggle?.setAttribute("aria-expanded", String(!c));
  if (untouched) fitUSAndRemember();
}
gapToggle?.addEventListener("click", () => setGapCollapsed(!gapNote.classList.contains("collapsed")));
gapToggle?.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); gapToggle.click(); } });

// Strongest AI-and-workforce measure a state has on this map (uses all entries, not the filters)
const RESPONSE_LEVELS = [
  { key: 0, label: "No workforce measure" },
  { key: 1, label: "Executive action or study" },
  { key: 2, label: "Bill pending" },
  { key: 3, label: "Law enacted" }
];
function isWorkforce(p) { return p.sector === "workforce" || isAlso(p, "workforce"); }
function responseOf(name) {
  const w = allFeatures.map(f => f.properties).filter(p => p.state === name && isWorkforce(p));
  const level = w.some(p => p.status === "passed") ? 3 : w.some(p => p.status === "pending") ? 2 : w.length ? 1 : 0;
  return { level, measures: w };
}

// Red vs. blue: share of Trump-won and Harris-won states with at least one enacted law per topic
const RB_TOPICS = ["synthetic_media", "chatbots", "consumer_transparency", "workforce", "healthcare", "government", "frontier_models", "comprehensive", "biometrics"];
let activeTopic = null;
function drawFindings() {
  const el = document.getElementById("gapFindings");
  if (!el || !POL) return;
  gapNote.classList.add("wide");
  const H = allFeatures.map(f => f.properties);
  const states = Object.keys(POL.states).filter(n => n !== "District of Columbia");
  const T = states.filter(n => POL.states[n].margin > 0), D = states.filter(n => POL.states[n].margin < 0);
  const inTopic = (p, sec) => p.sector === sec || isAlso(p, sec);
  const share = (g, sec) => Math.round(g.filter(n => H.some(p => p.state === n && p.status === "passed" && inTopic(p, sec))).length / g.length * 100);
  const perState = g => (H.filter(p => p.status === "passed" && g.includes(p.state)).length / g.length).toFixed(1);
  const rows = RB_TOPICS.map(sec => ({ sec, t: share(T, sec), d: share(D, sec) }))
    .filter(r => r.t || r.d).sort((a, b) => Math.max(b.t, b.d) - Math.max(a.t, a.d));
  const max = Math.max(...rows.map(r => Math.max(r.t, r.d)), 1);
  const lead = r => Math.abs(r.t - r.d) < 10 ? "similar" : (r.t > r.d ? "red states lead" : "blue states lead");
  el.innerHTML = `
    <div class="rb-key"><span><i style="background:#c0392b"></i>Trump-won (${T.length} states)</span><span><i style="background:#2c6fbb"></i>Harris-won (${D.length})</span></div>
    <p class="rb-headline">AI laws passed per state: <b>${perState(T)}</b> in Trump-won states, <b>${perState(D)}</b> in Harris-won states.</p>
    <div class="muted" style="font-size:11.5px;margin-bottom:4px">Share of states that have passed a law on…</div>
    ${rows.map(r => `<div class="rb-row${activeTopic === r.sec ? " active" : ""}" tabindex="0" role="button" data-sector="${r.sec}" aria-label="${safe(SECTOR_LABELS[r.sec])}: ${r.t}% of Trump-won states, ${r.d}% of Harris-won states">
      <div class="rb-label">${safe(SECTOR_LABELS[r.sec])}<small>${lead(r)}</small></div>
      <div class="rb-bar"><div class="rb-track"><span class="t" style="width:${(r.t / max) * 80}%"></span>${r.t}%</div></div>
      <div class="rb-bar"><div class="rb-track"><span class="d" style="width:${(r.d / max) * 80}%"></span>${r.d}%</div></div>
    </div>`).join("")}
    <p class="rb-hint">Click a topic to show only those entries on the map${activeTopic ? ` · <a href="#" id="rbClear">show all</a>` : ""}.</p>`;
  el.querySelectorAll(".rb-row").forEach(row => {
    const pick = () => {
      activeTopic = activeTopic === row.dataset.sector ? null : row.dataset.sector;
      if (sectorEl) { sectorEl.value = activeTopic || "all"; if (subcatWrap) subcatWrap.hidden = sectorEl.value !== "workforce"; }
      render(); drawFindings();
    };
    row.addEventListener("click", pick);
    row.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
  });
  el.querySelector("#rbClear")?.addEventListener("click", e => {
    e.preventDefault(); activeTopic = null; if (sectorEl) sectorEl.value = "all"; render(); drawFindings();
  });
}

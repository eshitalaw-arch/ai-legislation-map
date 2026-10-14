// ============================
// US AI Legislation Map (Leaflet)
// No-server mode: data comes from ./data/hubs.js as window.HUBS
// Hover popup stays open long enough to click links
// ============================

// 1) Create map
const map = L.map("map", { zoomControl: true, zoomSnap: 0.25 });
const US_BOUNDS = [[24.3, -124.8], [49.4, -64.5]];
function fitUS() {
  // Leave room on the right for the Northeast callout column
  const narrow = document.getElementById("map").clientWidth < 700;
  map.fitBounds(US_BOUNDS, { paddingTopLeft: [6, 6], paddingBottomRight: [narrow ? 44 : 10, 6] });
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
  const cmp = document.getElementById("compare");
  if (cmp && !cmp.hidden) drawCompare();
}


// Load entries from window.HUBS (rendered once the rest of the script has loaded)
const fc = window.HUBS;
allFeatures = (fc && Array.isArray(fc.features)) ? fc.features : [];

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
const POL = window.POLITICS_2024 || null;
const shadeSelect = document.getElementById("shadeSelect");
const riskScale = document.getElementById("riskScale");
const polScale = document.getElementById("polScale");
const shadeMode = () => { const v = shadeSelect ? shadeSelect.value : "none"; return v === "both" ? "politics" : v; };
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
      layer.on("mouseout", () => statesLayer.resetStyle(layer));
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
  return "";
}

shadeSelect?.addEventListener("change", () => {
  const mode = shadeMode();
  if (shadeSelect.value === "both") openCompare(); else closeCompare(false);
  if (riskScale) riskScale.hidden = mode !== "risk";
  if (polScale) polScale.hidden = mode !== "politics";
  statesLayer?.setStyle(stateStyle);
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
// Comparison chart: job risk (y) vs. 2024 presidential margin (x), one dot per state
// ============================
const compareEl = document.getElementById("compare");
const compareChart = document.getElementById("compareChart");
const compareTable = document.getElementById("compareTable");
const ABBR = { "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO","Connecticut":"CT","Delaware":"DE",
  "Florida":"FL","Georgia":"GA","Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY",
  "Louisiana":"LA","Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI","Minnesota":"MN","Mississippi":"MS","Missouri":"MO",
  "Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY",
  "North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK","Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI",
  "South Carolina":"SC","South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT","Virginia":"VA","Washington":"WA",
  "West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY" };
let compareTip = null;

// Strongest AI-and-workforce measure a state has on this map (uses all entries, not the filters)
const RESPONSE_LEVELS = [
  { key: 0, label: "No workforce measure", sub: "nothing on this map" },
  { key: 1, label: "Executive action or study", sub: "orders, programs, reports" },
  { key: 2, label: "Bill pending", sub: "not yet law" },
  { key: 3, label: "Law enacted", sub: "signed into law" }
];
function isWorkforce(p) { return p.sector === "workforce" || isAlso(p, "workforce"); }
function responseOf(name) {
  const w = allFeatures.map(f => f.properties).filter(p => p.state === name && isWorkforce(p));
  const level = w.some(p => p.status === "passed") ? 3 : w.some(p => p.status === "pending") ? 2 : w.length ? 1 : 0;
  return { level, measures: w };
}

function compareRows() {
  return Object.keys(ABBR).filter(n => POL && POL.states[n] && RISK && RISK.states[n]).map(n => {
    const resp = responseOf(n);
    return { name: n, abbr: ABBR[n], margin: POL.states[n].margin, r: POL.states[n].r_pct, d: POL.states[n].d_pct,
      risk: RISK.states[n].pct_median, jobs: RISK.states[n].jobs_median, level: resp.level, measures: resp.measures };
  });
}

function textOn(hex) {
  const [r, g, b] = hex.match(/\w\w/g).map(h => parseInt(h, 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? "#1f1f1f" : "#fff";
}

function drawFindings(rows) {
  const el = document.getElementById("compareFindings");
  if (!el) return;
  const total = rows.reduce((a, r) => a + r.jobs, 0);
  const share = f => rows.filter(f).reduce((a, r) => a + r.jobs, 0) / total;
  const noticeStates = rows.filter(r => r.measures.some(p => p.layoff_notice === true && p.status === "passed")).map(r => r.name);
  const trump = rows.filter(r => r.margin > 0), harris = rows.filter(r => r.margin < 0);
  const enacted = g => g.reduce((a, r) => a + r.measures.filter(p => p.status === "passed").length, 0);
  const sorted = [...rows].sort((a, b) => b.risk - a.risk);
  const topThird = sorted.slice(0, Math.round(rows.length / 3));
  const gaps = topThird.filter(r => r.level === 0).map(r => r.name);
  const fmtM = x => (x / 1e6).toFixed(1) + "M";
  el.innerHTML = `
    <div class="finding"><span class="fig">${Math.round(share(r => r.level === 0) * 100)}%</span>of the ${fmtM(total)} jobs at risk are in states with no AI-workforce measure on this map.</div>
    <div class="finding"><span class="fig">${Math.round(share(r => noticeStates.includes(r.name)) * 100)}%</span>are in a state that has enacted a law requiring AI to be disclosed in layoff notices${noticeStates.length ? ` (${noticeStates.join(" and ")} only)` : ""}.</div>
    <div class="finding"><span class="fig">${enacted(trump)} vs ${enacted(harris)}</span>enacted AI-workforce laws in the ${trump.length} Trump-won vs the ${harris.length} Harris-won states.${enacted(trump) === 0 ? " Trump-won states' measures so far are executive orders, training programs and studies." : ""}</div>
    <div class="finding"><span class="fig">${gaps.length}</span>of the ${topThird.length} highest-risk states have no AI-workforce measure on this map${gaps.length ? `: ${gaps.join(", ")}` : ""}.</div>`;
}

function drawCompare() {
  if (!compareChart) return;
  const rows = compareRows();
  drawFindings(rows);
  // Draw at the container's real width so text stays readable on phones
  const W = Math.max(340, Math.min(860, compareChart.clientWidth || 860));
  const narrow = W < 600;
  const H = narrow ? 460 : 470, m = { t: 44, r: 10, b: 14, l: narrow ? 44 : 56 };
  const yMin = 0.044, yMax = 0.076;
  const Y = v => H - m.b - ((v - yMin) / (yMax - yMin)) * (H - m.t - m.b);
  const colW = (W - m.l - m.r) / RESPONSE_LEVELS.length;
  const colX = k => m.l + colW * (k + 0.5);
  const maxJobs = Math.max(...rows.map(r => r.jobs));
  const rad = j => (narrow ? 6.5 : 8) + (narrow ? 9 : 13) * Math.sqrt(j / maxJobs);
  let g = "";
  RESPONSE_LEVELS.forEach((c, k) => {
    if (k % 2 === 1) g += `<rect class="col-band" x="${m.l + colW * k}" y="${m.t - 6}" width="${colW}" height="${H - m.t - m.b + 6}"/>`;
    const count = rows.filter(r => r.level === c.key).length;
    g += `<text class="col-label" x="${colX(k)}" y="${narrow ? 14 : 16}" text-anchor="middle">${narrow ? ["None", "Action/study", "Pending", "Enacted"][k] : c.label}</text>` +
         `<text class="col-sub" x="${colX(k)}" y="${narrow ? 28 : 31}" text-anchor="middle">${count} states${narrow ? "" : " · " + c.sub}</text>`;
  });
  for (let t = 0.045; t <= 0.0751; t += 0.005) {
    g += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}"/>` +
         `<text class="axis-text" x="${m.l - 6}" y="${Y(t)}" text-anchor="end" dominant-baseline="central">${(t * 100).toFixed(1)}%</text>`;
  }
  g += `<text class="axis-title" transform="translate(11 ${(H - m.b + m.t) / 2}) rotate(-90)" text-anchor="middle">${narrow ? "Jobs at risk ↑" : "Share of jobs at risk from AI ↑"}</text>`;

  // Beeswarm within each column: height stays exact (job risk); dots slide sideways to the nearest free spot
  const pts = rows.map(d => ({ d, x0: colX(d.level), y0: Y(d.risk), x: colX(d.level), y: Y(d.risk), r: rad(d.jobs) }));
  RESPONSE_LEVELS.forEach(c => {
    const col = pts.filter(q => q.d.level === c.key).sort((a, b) => b.r - a.r);
    const placed = [];
    col.forEach(q => {
      const half = colW / 2 - q.r - 2;
      const fits = (x, y) => placed.every(o => Math.hypot(o.x - x, o.y - y) >= o.r + q.r + 1);
      let best = null;
      // Try sideways offsets first; if the column is full, allow a small vertical nudge
      for (let dy = 0; dy <= 60 && !best; dy += 2) {
        for (const sy of dy ? [1, -1] : [1]) {
          for (let off = 0; off <= half && !best; off += 1) {
            for (const sx of off ? [1, -1] : [1]) {
              const x = q.x0 + sx * off, y = q.y0 + sy * dy;
              if (fits(x, y)) { best = { x, y }; break; }
            }
          }
          if (best) break;
        }
      }
      if (best) { q.x = best.x; q.y = best.y; }
      placed.push(q);
    });
  });
  pts.sort((a, b) => b.r - a.r).forEach(q => {
    const d = q.d, fill = polColor(d.margin);
    g += `<g class="pt" tabindex="0" role="button" data-state="${safe(d.name)}" aria-label="${safe(d.name)}: ${pct(d.risk)} of jobs at risk; ${RESPONSE_LEVELS[d.level].label}; 2024 ${marginText(d.margin)}">` +
      `<circle class="dot" cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="${q.r.toFixed(1)}" fill="${fill}"/>` +
      (q.r >= 8 ? `<text class="dot-label" x="${q.x.toFixed(1)}" y="${q.y.toFixed(1)}" fill="${textOn(fill)}">${d.abbr}</text>` : "") + `</g>`;
  });
  compareChart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="States by share of jobs at risk from AI and strongest AI-workforce measure, colored by 2024 presidential result">${g}</svg>`;

  const byName = Object.fromEntries(rows.map(r => [r.name, r]));
  compareChart.querySelectorAll("g.pt").forEach(el => {
    const d = byName[el.dataset.state];
    const show = () => {
      if (!compareTip) { compareTip = document.createElement("div"); compareTip.className = "compare-tip"; document.body.appendChild(compareTip); }
      const list = d.measures.slice(0, 4).map(p => `<li>${safe(p.title.replace(/^[^–]+–\s*/, ""))} <span style="opacity:.7">(${safe(STATUS_LABELS[p.status])})</span></li>`).join("");
      compareTip.innerHTML = `<strong>${safe(d.name)}</strong><br>Jobs at risk: <b>${pct(d.risk)}</b> (about ${num(d.jobs)})` +
        `<br>2024: <b>${marginText(d.margin)}</b> (Trump ${pct(d.r)}, Harris ${pct(d.d)})` +
        `<br>Workforce response: <b>${RESPONSE_LEVELS[d.level].label}</b>` +
        (list ? `<ul style="margin:4px 0 0;padding-left:16px">${list}</ul>${d.measures.length > 4 ? `<span style="opacity:.7">+${d.measures.length - 4} more</span><br>` : ""}` : "<br>") +
        `<span style="opacity:.7">Click for state profile</span>`;
      const b = el.getBoundingClientRect();
      compareTip.style.left = Math.max(8, Math.min(window.innerWidth - 270, b.right + 8)) + "px";
      compareTip.style.top = Math.max(8, Math.min(window.innerHeight - 220, b.top - 10)) + "px";
      compareTip.hidden = false;
    };
    const hide = () => { if (compareTip) compareTip.hidden = true; };
    el.addEventListener("mouseenter", show); el.addEventListener("focus", show);
    el.addEventListener("mouseleave", hide); el.addEventListener("blur", hide);
    const open = () => { hide(); openProfile(d.name); };
    el.addEventListener("click", open);
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });

  if (compareTable) {
    const sorted = [...rows].sort((a, b) => b.risk - a.risk);
    compareTable.innerHTML = `<table><thead><tr><th>State</th><th class="num">Jobs at risk</th><th class="num">Number</th><th>Strongest workforce measure</th><th class="num">2024</th></tr></thead><tbody>` +
      sorted.map(d => `<tr><td>${safe(d.name)}</td><td class="num">${pct(d.risk)}</td><td class="num">${num(d.jobs)}</td><td>${RESPONSE_LEVELS[d.level].label}</td><td class="num">${marginText(d.margin)}</td></tr>`).join("") +
      `</tbody></table>`;
  }
}

function openCompare() {
  if (!compareEl) return;
  drawCompare();
  compareEl.hidden = false;
}
function closeCompare(resetSelect = true) {
  if (!compareEl || compareEl.hidden) return;
  compareEl.hidden = true;
  if (compareTip) compareTip.hidden = true;
  if (resetSelect && shadeSelect && shadeSelect.value === "both") shadeSelect.value = "politics";
}
document.getElementById("compareClose")?.addEventListener("click", () => closeCompare());
document.getElementById("compareTableToggle")?.addEventListener("click", e => {
  e.preventDefault();
  compareTable.hidden = !compareTable.hidden;
  e.target.textContent = compareTable.hidden ? "View as table" : "Hide table";
});
document.addEventListener("keydown", e => { if (e.key === "Escape") closeCompare(); });
window.addEventListener("resize", () => { if (compareEl && !compareEl.hidden) drawCompare(); });

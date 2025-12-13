/*******************************************************
 * P5.js — Environmental Snapshot Viewer (Mobile-first)
 * Complete sketch.js
 *
 * What it does:
 * 1) Loads entries from either:
 *    A) Google Apps Script doGet() JSON endpoint (USE_API = true)
 *    B) Local mock data (USE_API = false)
 * 2) Filters out rows where note === "null" (string)
 *    - Keeps empty note "" (so new entries still show)
 * 3) Computes note word count for each entry
 * 4) Renders a FLOW GRID (Option B):
 *    - portrait cell height
 *    - variable cell widths derived from humidity ring size
 *    - no horizontal gutters between cells
 *    - continuous baseline across full width margin-to-margin per row
 * 5) Tap/click a cell -> full-screen modal detail
 * 6) Refresh button:
 *    - If USE_API: fetch now + poll every 3s for 15s
 *    - If USE_API=false: reloads mock data (no polling)
 *
 * Notes:
 * - Mobile: touchStarted() calls handlePress() and returns false to prevent scroll
 * - Latest-first display is controlled by SHOW_LATEST_FIRST
 *******************************************************/

/* =========================
   MODE SWITCHES
========================= */
const USE_API = false; // <-- set true when you want to use Apps Script
const LIGHT_MODE = true; // <-- set false for dark mode
const SHOW_LATEST_FIRST = true; // newest at top-left

// Apps Script Web App URL (doGet returns array of events)
const GAS_GET_URL = "PASTE_YOUR_EXEC_URL_HERE"; // e.g. https://script.google.com/macros/s/.../exec

// Polling burst after refresh (API mode only)
const POLL_INTERVAL_MS = 3000;
const POLL_TOTAL_MS = 15000;

/* =========================
   MOCK DATA (10 items)
   - photo_url left blank
   - includes: empty note "", and one "null" filter case
========================= */
const mockData = [
  {
    created_at: "2025-12-12T07:52:10",
    event_id: 1,
    temp_c: 21.2,
    humidity_pct: 18.0,
    sound_loudness: 8,
    note: "Quiet indoor morning. Heater running.",
    photo_url: "",
  },
  {
    created_at: "2025-12-12T08:15:42",
    event_id: 2,
    temp_c: 20.1,
    humidity_pct: 23.0,
    sound_loudness: 14,
    note: "", // empty note should still show (needs note)
    photo_url: "",
  },
  {
    created_at: "2025-12-12T09:03:11",
    event_id: 3,
    temp_c: 3.4,
    humidity_pct: 68.0,
    sound_loudness: 22,
    note: "Outside walk. Windy and damp. Light traffic.",
    photo_url: "",
  },
  {
    created_at: "2025-12-12T09:55:09",
    event_id: 4,
    temp_c: -5.8,
    humidity_pct: 54.0,
    sound_loudness: 19,
    note: "Cold street. Crunchy steps. Few cars.",
    photo_url: "",
  },
  {
    created_at: "2025-12-12T10:40:50",
    event_id: 5,
    temp_c: 24.6,
    humidity_pct: 13.0,
    sound_loudness: 11,
    note: "Very dry indoor air. Felt static on clothes.",
    photo_url: "",
  },
  {
    created_at: "2025-12-12T12:18:33",
    event_id: 6,
    temp_c: 17.2,
    humidity_pct: 42.0,
    sound_loudness: 47,
    note: "Café/lobby chatter. Espresso machine bursts.",
    photo_url: "",
  },
  {
    created_at: "2025-12-12T14:06:27",
    event_id: 7,
    temp_c: 1.1,
    humidity_pct: 79.0,
    sound_loudness: 28,
    note: "Snowy sidewalk. Quiet, occasional bus rumble.",
    photo_url: "",
  },
  {
    created_at: "2025-12-12T16:02:40",
    event_id: 8,
    temp_c: 7.9,
    humidity_pct: 61.0,
    sound_loudness: 74,
    note: "Busy intersection. Siren spike + crosswalk beeps.",
    photo_url: "",
  },
  {
    created_at: "2025-12-12T18:30:05",
    event_id: 9,
    temp_c: 19.8,
    humidity_pct: 31.0,
    sound_loudness: 16,
    note: "null", // this one should be filtered out
    photo_url: "",
  },
  {
    created_at: "2025-12-12T21:12:18",
    event_id: 10,
    temp_c: 22.9,
    humidity_pct: 36.0,
    sound_loudness: 91,
    note: "Crowded indoor room. Music + overlapping voices.",
    photo_url: "",
  },
];

/* =========================
   THEME
========================= */
function theme() {
  if (LIGHT_MODE) {
    return {
      bg: 245,
      topBar: 235,
      panel: 255,
      text: 10,
      subtext: 60,
      stroke: 0,

      btnFill: 255,
      btnFillHover: 250,
      btnStroke: 0,

      overlay: [0, 120],
      link: [0, 0, 200],
    };
  }

  // Dark mode
  return {
    bg: 0,
    topBar: 20,

    // IMPORTANT: if you want true dark cells, change panel to something like 25
    // panel: 25,
    panel: 255,

    text: 255,
    subtext: 200,
    stroke: 0,

    btnFill: 40,
    btnFillHover: 60,
    btnStroke: 255,

    overlay: [0, 200],
    link: [0, 0, 200],
  };
}

/* =========================
   LAYOUT / TUNING KNOBS
   (Option B flow grid)
========================= */
const UI = {
  margin: 12,

  // Flow grid
  cellH: 110, // portrait cell height (px)
  baselinePx: 75, // baseline y from top of row (px)
  rowGap: 0, // vertical gap between rows (px)
  sidePad: 8, // used for width calculation
  minW: 78,
  maxW: 190,

  // Geometry in local 100x100 design space
  tempDia: 14, // diameter of temp circle (local units)
  humGapMin: 1, // humidity ring gap min (local radial thickness)
  humGapMax: 12, // humidity ring gap max (local radial thickness)

  // Text (pixel space; uniform)
  textEventSize: 18,
  textNoteSize: 14,
  textArrowSize: 18,

  // Add-note placement
  reminderOffsetLocal: 24, // local units above circle center

  // Top bar height
  topBarH: 70,
};

/* =========================
   DATA + UI STATE
========================= */
let rawData = [];
let entries = []; // normalized + filtered + enriched
let validEntryIndex = []; // indices of entries to display
let lastMaxEventId = 0;

let selectedIndex = -1;
let statusMsg = "Not loaded yet.";
let isFetching = false;

// Refresh button bounds
let refreshBtn = { x: 0, y: 0, w: 140, h: 40 };

// Polling burst
let polling = false;
let pollTimer = null;
let pollStartMs = 0;
let pollTicks = 0;

/* =========================
   P5 SETUP / DRAW
========================= */
function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("system-ui");
  setupRefreshButton();

  loadInitialData();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  setupRefreshButton();
}

function draw() {
  const T = theme();
  background(T.bg);

  drawTopBar();
  drawGrid();

  if (selectedIndex >= 0) {
    drawModal(entries[selectedIndex]);
  }
}

function setupRefreshButton() {
  refreshBtn.w = 140;
  refreshBtn.h = 40;
  refreshBtn.x = width - UI.margin - refreshBtn.w;
  refreshBtn.y = UI.margin + 12;
}

/* =========================
   DATA LOADING
========================= */
function loadInitialData() {
  if (USE_API) {
    fetchAndUpdate("Initial load");
  } else {
    rawData = mockData.slice();
    processRawData("Mock data loaded");
  }
}

async function fetchAndUpdate(reason = "manual") {
  if (!USE_API) {
    statusMsg = "USE_API is false (mock mode).";
    return;
  }

  if (!GAS_GET_URL || GAS_GET_URL.includes("PASTE_YOUR")) {
    statusMsg = "Set GAS_GET_URL first.";
    return;
  }

  if (isFetching) return;
  isFetching = true;
  statusMsg = `Fetching… (${reason})`;

  try {
    const url = `${GAS_GET_URL}?t=${Date.now()}`; // cache-bust
    const resp = await fetch(url, { method: "GET" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    rawData = Array.isArray(data) ? data : [];
    processRawData(`Loaded (${reason})`);
  } catch (err) {
    statusMsg = `Fetch error: ${String(err)}`;
  } finally {
    isFetching = false;
  }
}

function processRawData(reason = "") {
  // Normalize + filter:
  // - skip note === "null" (string)
  // - keep empty note "" (new entries)
  entries = rawData.map(normalizeEntry).filter((d) => d.note !== "null");

  // Sort by event_id asc so “latest first” can just reverse display indices
  entries.sort((a, b) => (a.event_id || 0) - (b.event_id || 0));

  validEntryIndex = entries.map((_, i) => i);

  const maxId = entries.reduce((m, d) => max(m, d.event_id || 0), 0);
  const was = lastMaxEventId;
  lastMaxEventId = maxId;

  if (USE_API && maxId > was && was !== 0) {
    statusMsg = `✅ New entry detected: event_id ${maxId}`;
  } else {
    statusMsg = `${reason}. Entries: ${entries.length}. Latest: ${
      maxId || "—"
    }`;
  }
}

function normalizeEntry(d) {
  const eventId = safeInt(d.event_id);
  const tempC = safeFloat(d.temp_c);
  const humidity = safeFloat(d.humidity_pct);
  const sound = safeFloat(d.sound_loudness);
  const note = (d.note ?? "").toString();
  const photoUrl = (d.photo_url ?? "").toString();
  const createdAt = d.created_at ?? "";

  return {
    created_at: createdAt,
    event_id: eventId,
    temp_c: tempC,
    humidity_pct: humidity,
    sound_loudness: sound,
    note,
    note_word_count: wordCount(note),
    photo_url: photoUrl,

    // UI hit targets
    __cellBounds: null,
    __closeBounds: null,
  };
}

function safeInt(x) {
  const n = parseInt(x, 10);
  return Number.isFinite(n) ? n : 0;
}

function safeFloat(x) {
  const n = parseFloat(x);
  return Number.isFinite(n) ? n : 0;
}

function wordCount(str) {
  const s = (str ?? "").trim();
  if (!s) return 0;
  return s.split(/\s+/).length;
}

/* =========================
   REFRESH + POLLING BURST
========================= */
function startRefreshAction() {
  if (!USE_API) {
    // Mock mode: just reload mock data instantly
    rawData = mockData.slice();
    processRawData("Mock data reloaded");
    return;
  }
  startPollingBurst();
}

function startPollingBurst() {
  stopPollingBurst();

  polling = true;
  pollStartMs = millis();
  pollTicks = 0;
  statusMsg = "Refreshing… (polling for new entry)";

  fetchAndUpdate("Refresh burst");

  pollTimer = setInterval(async () => {
    pollTicks++;
    await fetchAndUpdate(`Poll ${pollTicks}`);

    const elapsed = millis() - pollStartMs;
    if (elapsed >= POLL_TOTAL_MS) {
      stopPollingBurst();
      statusMsg = `Done polling (${Math.round(
        POLL_TOTAL_MS / 1000
      )}s). Latest: ${lastMaxEventId || "—"}`;
    }
  }, POLL_INTERVAL_MS);
}

function stopPollingBurst() {
  polling = false;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

/* =========================
   TOP BAR + BUTTON
========================= */
function drawTopBar() {
  const T = theme();

  noStroke();
  fill(T.topBar);
  rect(0, 0, width, UI.topBarH);

  fill(T.text);
  textSize(14);
  textAlign(LEFT, CENTER);
  text("Environmental Snapshot Viewer", UI.margin, 24);

  fill(T.subtext);
  textSize(12);
  text(statusMsg, UI.margin, 48);

  drawRefreshButton();
}

function drawRefreshButton() {
  const T = theme();
  const { x, y, w, h } = refreshBtn;
  const hovering = isPointInRect(mouseX, mouseY, refreshBtn);

  stroke(T.btnStroke);
  strokeWeight(1);
  fill(hovering ? T.btnFillHover : T.btnFill);
  rect(x, y, w, h, 10);

  noStroke();
  fill(T.text);
  textAlign(CENTER, CENTER);
  textSize(13);

  let label = "Refresh";
  if (!USE_API) label = "Reload Mock";
  else if (polling) label = "Checking…";

  text(label, x + w / 2, y + h / 2);
}

/* =========================
   DRAW: FLOW GRID (Option B)
   - variable widths driven by humidity ring size (relative ring)
   - wraps rows
   - ONE continuous baseline per row (margin-to-margin)
========================= */
function drawGrid() {
  const T = theme();
  const topOffset = UI.topBarH + UI.margin;

  if (!entries.length) {
    fill(T.subtext);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(14);
    text("No entries yet (or all filtered).", width / 2, height / 2);
    return;
  }

  // Decide display order (use indices so we don't mutate entries)
  let displayIndices = validEntryIndex.slice();
  if (SHOW_LATEST_FIRST) displayIndices.reverse();

  let cursorX = UI.margin;
  let cursorY = topOffset;
  let rowBaselineY = cursorY + UI.baselinePx;

  function drawRowBaseline(yPx) {
    stroke(T.stroke);
    strokeWeight(2);
    strokeCap(SQUARE);
    line(UI.margin, yPx, width - UI.margin, yPx);
  }

  for (let k = 0; k < displayIndices.length; k++) {
    const entryIdx = displayIndices[k];
    const d = entries[entryIdx];

    // Humidity as a "gap thickness" outside temp circle (relative ring logic)
    const hum = constrain(d.humidity_pct, 0, 100);
    const humGap = map(hum, 0, 100, UI.humGapMin, UI.humGapMax);
    const humDiaLocal = UI.tempDia + 2 * humGap; // diameter in local 0..100 units

    // Convert local diameter -> pixels using scale derived from CELL_H
    const sFromH = UI.cellH / 100;
    const ringDiameterPx = humDiaLocal * sFromH;

    // Variable width: ring diameter + padding + breathing room
    let cellW = ringDiameterPx + UI.sidePad * 2 + 40;
    cellW = constrain(cellW, UI.minW, UI.maxW);

    const rightLimit = width - UI.margin;

    // Wrap to next row if needed
    if (cursorX + cellW > rightLimit) {
      drawRowBaseline(rowBaselineY);

      cursorX = UI.margin;
      cursorY += UI.cellH + UI.rowGap;
      rowBaselineY = cursorY + UI.baselinePx;
    }

    drawCell(d, cursorX, cursorY, cellW, UI.cellH, entryIdx, rowBaselineY);

    cursorX += cellW;
  }

  // Baseline for last row
  drawRowBaseline(rowBaselineY);
}

/* =========================
   DRAW: SINGLE CELL
   - geometry drawn in centered uniform-scaled 100x100 space
   - text drawn in pixel space so size is uniform
   - baseline shared via baselineYpx
========================= */
function drawCell(d, x, y, w, h, entryIndex, baselineYpx) {
  const T = theme();

  // ---------- cell background ----------
  noStroke();
  fill(T.panel);
  rect(x, y, w, h);

  // ---------- layout (pixel space) ----------
  // Uniform scale so circles stay circles (no x/y squish)
  const SCALE = min(w, h) / 100;

  // Center the 100×100 design space inside the rectangle
  const DX = (w - 100 * SCALE) / 2;
  const DY = (h - 100 * SCALE) / 2;

  // Baseline (px) -> local (0..100) inside design space
  const baselineLocalY = (baselineYpx - (y + DY)) / SCALE;

  // Stem height from note word count (local units)
  const wc = constrain(d.note_word_count, 0, 60);
  const stemTopLocalY = baselineLocalY - wc;

  // Humidity as “gap thickness” outside temp circle
  const hum = constrain(d.humidity_pct, 0, 100);
  const humGap = map(hum, 0, 100, UI.humGapMin, UI.humGapMax);
  const humDia = UI.tempDia + 2 * humGap;

  // ---------- draw geometry in local 100×100 space ----------
  push();
  translate(x + DX, y + DY);
  scale(SCALE);

  // Stem
  stroke(T.stroke);
  strokeWeight(2);
  line(50, baselineLocalY, 50, stemTopLocalY);

  // Temp circle (HSB hue mapped from temp_c)
  colorMode(HSB, 360, 100, 100, 1);
  const hue = map(constrain(d.temp_c, -10, 35), -10, 35, 220, 20);
  noStroke();
  fill(hue, 80, 90, 1);
  circle(50, stemTopLocalY, UI.tempDia);
  colorMode(RGB, 255);

  // Humidity ring (relative to temp circle)
  noFill();
  stroke(T.stroke);
  strokeWeight(2);
  circle(50, stemTopLocalY, humDia);

  // Mask below baseline (must match panel color)
  noStroke();
  fill(T.panel);
  rect(0, baselineLocalY, 100, 25);

  pop();

  // ---------- TEXT in pixel space (uniform size) ----------
  const cx = x + w / 2;

  fill(T.text);
  noStroke();
  textAlign(CENTER, CENTER);

  // Event ID below baseline
  textSize(UI.textEventSize);
  text(`${d.event_id}`, cx, baselineYpx + 26);

  // Add-note reminder (above the circle, follows stem top)
  if ((d.note ?? "").trim() === "") {
    const reminderYLocal = stemTopLocalY - UI.reminderOffsetLocal;
    const reminderYpx = y + DY + reminderYLocal * SCALE;

    fill(T.text);
    textSize(UI.textNoteSize);
    text("add note", cx, reminderYpx - 20);

    textSize(UI.textArrowSize);
    text("↓", cx, reminderYpx);
  }

  // Store click bounds
  d.__cellBounds = { x, y, w, h, entryIndex };
}

/* =========================
   MODAL DETAIL VIEW
========================= */
function drawModal(d) {
  const T = theme();

  // Dim overlay
  noStroke();
  fill(T.overlay[0], T.overlay[1]);
  rect(0, 0, width, height);

  // Card
  const pad = 16;
  const cardW = width - pad * 2;
  const cardH = height - pad * 2;

  fill(T.panel);
  rect(pad, pad, cardW, cardH, 16);

  // Close button
  const closeSize = 34;
  const closeX = pad + cardW - closeSize - 10;
  const closeY = pad + 10;

  fill(T.stroke);
  rect(closeX, closeY, closeSize, closeSize, 10);

  fill(T.panel);
  textAlign(CENTER, CENTER);
  textSize(16);
  text("✕", closeX + closeSize / 2, closeY + closeSize / 2);

  // Text content
  fill(T.text);
  textAlign(LEFT, TOP);

  const x = pad + 18;
  let y = pad + 18;

  textSize(18);
  text(`event_id: ${d.event_id}`, x, y);
  y += 26;

  textSize(12);
  text(`created_at: ${d.created_at}`, x, y);
  y += 22;

  textSize(14);
  text(`Temp (°C): ${d.temp_c}`, x, y);
  y += 22;
  text(`Humidity (%): ${d.humidity_pct}`, x, y);
  y += 22;
  text(`Sound loudness: ${d.sound_loudness}`, x, y);
  y += 22;
  text(`Note word count: ${d.note_word_count}`, x, y);
  y += 28;

  textSize(14);
  text("Note:", x, y);
  y += 22;

  const noteText =
    (d.note ?? "").trim() === "" ? "(empty — submit via Google Form)" : d.note;

  const noteBoxW = cardW - 36;
  const noteBoxH = 160;

  noFill();
  stroke(T.stroke);
  rect(x, y, noteBoxW, noteBoxH, 10);

  noStroke();
  fill(T.text);
  textSize(13);
  text(noteText, x + 10, y + 10, noteBoxW - 20, noteBoxH - 20);
  y += noteBoxH + 18;

  textSize(14);
  fill(T.text);
  text("photo_url:", x, y);
  y += 20;

  textSize(12);
  fill(...T.link);
  text(d.photo_url || "(none)", x, y, noteBoxW, 60);

  // Save close bounds
  d.__closeBounds = { x: closeX, y: closeY, w: closeSize, h: closeSize };
}

/* =========================
   INTERACTION (mouse + touch)
========================= */
function mousePressed() {
  handlePress(mouseX, mouseY);
}

function touchStarted() {
  if (touches && touches.length > 0) {
    handlePress(touches[0].x, touches[0].y);
    return false; // prevent scroll
  }
}

function handlePress(px, py) {
  // Modal open -> close button
  if (selectedIndex >= 0) {
    const d = entries[selectedIndex];
    if (d.__closeBounds && isPointInRect(px, py, d.__closeBounds)) {
      selectedIndex = -1;
    }
    return;
  }

  // Refresh
  if (isPointInRect(px, py, refreshBtn)) {
    startRefreshAction();
    return;
  }

  // Cells
  for (const d of entries) {
    if (!d.__cellBounds) continue;
    if (isPointInRect(px, py, d.__cellBounds)) {
      selectedIndex = d.__cellBounds.entryIndex;
      return;
    }
  }
}

function isPointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

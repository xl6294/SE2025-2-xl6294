/*******************************************************
 * P5.js — Environmental Snapshot Viewer (Mobile-first)
 * Full sketch.js (clean + responsive + theme-aware)
 *
 * Features:
 * - USE_API toggle (Apps Script) vs mock data
 * - Filters out entries where note === "null" (string)
 * - Keeps empty note "" (shows add note reminder)
 * - Word count for note
 * - Flow grid (variable cell widths), shared baseline per row
 * - Tap/click cell opens modal
 * - Refresh button: reload mock OR poll API burst
 * - LIGHT_MODE theme toggle
 * - Responsive scaling so UI is readable on phones
 *******************************************************/

/* =========================
   MODE SWITCHES
========================= */
const USE_API = false; // <-- set true when you want to use Apps Script
const LIGHT_MODE = true; // <-- true = light, false = dark
const SHOW_LATEST_FIRST = true;

// Apps Script Web App URL (doGet returns array of events)
const GAS_GET_URL =
  "https://script.google.com/macros/s/AKfycbyrm87nzk47xy1s7ojSL0HR44Ml9KwUk7RAqYcofmQzEBHp99Rd1hZva3KziSVrbR93/exec";

// Polling burst after refresh (API mode only)
const POLL_INTERVAL_MS = 3000;
const POLL_TOTAL_MS = 15000;

/* =========================
   MOCK DATA (10 items)
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
    note: "",
    photo_url: "",
  }, // empty note should show
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
    note: "null",
    photo_url: "",
  }, // filtered out
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
   - bg: canvas background
   - topBar: header strip
   - panel: cell + modal card fill
   - ink: lines (baseline, rings, stems)
   - text/subtext: text colors
========================= */
function theme() {
  if (LIGHT_MODE) {
    const bg = 245;
    return {
      bg,
      topBar: 235,
      panel: bg, // match page bg (so cells don't look like cards)
      ink: 0,
      text: 10,
      subtext: 70,
      btnFill: 255,
      btnFillHover: 250,
      btnStroke: 0,
      overlay: [0, 120],
      link: [0, 0, 200],
    };
  }

  const bg = 10;
  return {
    bg,
    topBar: 18,
    panel: bg, // match page bg
    ink: 235,
    text: 235,
    subtext: 170,
    btnFill: 28,
    btnFillHover: 40,
    btnStroke: 235,
    overlay: [0, 210],
    link: [120, 170, 255],
  };
}

/* =========================
   LAYOUT / TUNING KNOBS
========================= */

// Base design tuned around iPhone width (~390px)
const UI_BASE = {
  // Global spacing
  margin: 12,
  topBarH: 70,

  // Flow grid layout
  cellH: 110, // portrait cell height (px)
  baselinePx: 75, // baseline within row (px from cell top)
  rowGap: 0, // vertical gap between rows (px)
  sidePad: 8, // influences width calc (px)
  minW: 78,
  maxW: 190,

  // Geometry in local 100×100 design space
  tempDia: 14, // local units
  humGapMin: 1, // local units
  humGapMax: 12, // local units
  reminderOffsetLocal: 24, // local units above circle

  // Cell text (pixel space)
  textEventSize: 18,
  textNoteSize: 14,
  textArrowSize: 18,

  // Button
  btnW: 80,
  btnH: 40,
  btnRadius: 12,
  btnTextSize: 16,

  // Modal sizing (pixel space)
  modalPad: 16,
  modalCloseSize: 34,
  modalCloseRadius: 10,
  modalTitleSize: 18,
  modalMetaSize: 12,
  modalLineSize: 14,
  modalNoteLabelSize: 14,
  modalNoteTextSize: 13,
  modalNoteBoxH: 160,
  modalPhotoLabelSize: 14,
  modalPhotoTextSize: 12,
};

// Active UI (scaled by applyResponsiveUI)
let UI = { ...UI_BASE };

// function applyResponsiveUI() {
//   // Make UI BIGGER on phones (small physical screens)
//   const phoneRefMin = 760; // or 760 for “treat most phones as phone-ish”
//   const minDim = min(width, height);

//   let s = 1.0;
//   if (minDim <= phoneRefMin) {
//     s = map(minDim, 320, phoneRefMin, 1.9, 1.4);
//   }
//   s = constrain(s, 1.0, 1.9);

//   UI = { ...UI_BASE };
//   for (const k of Object.keys(UI)) {
//     if (typeof UI[k] === "number") UI[k] = UI_BASE[k] * s;
//   }

//   // keep margin from exploding
//   UI.margin = constrain(UI.margin, 10, 18);

//   // update button bounds after scaling
//   setupRefreshButton();
// }

function applyResponsiveUI() {
  // Treat anything with a "small side" <= this as phone/tablet UI
  const phoneRefMin = 760; // <- bump this up
  const minDim = min(width, height);

  let s = 1.0;

  if (minDim <= phoneRefMin) {
    // Smaller side => bigger scale
    s = map(minDim, 360, phoneRefMin, 2.0, 1.35);
  }

  s = constrain(s, 1.0, 2.0);

  UI = { ...UI_BASE };
  for (const k of Object.keys(UI)) {
    if (typeof UI[k] === "number") UI[k] = UI_BASE[k] * s;
  }

  UI.margin = constrain(UI.margin, 10, 18);
  setupRefreshButton();
}

/* =========================
   DATA + UI STATE
========================= */
let rawData = [];
let entries = [];
let validEntryIndex = [];
let lastMaxEventId = 0;

let selectedIndex = -1;
let statusMsg = "Not loaded yet.";
let isFetching = false;

let refreshBtn = { x: 0, y: 0, w: 140, h: 40 };

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

  applyResponsiveUI();
  setupRefreshButton();
  loadInitialData();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  applyResponsiveUI();
  setupRefreshButton();
}

function draw() {
  const T = theme();
  background(T.bg);

  drawTopBar();
  drawGrid();

  if (selectedIndex >= 0) drawModal(entries[selectedIndex]);
}

function setupRefreshButton() {
  refreshBtn.w = UI.btnW;
  refreshBtn.h = UI.btnH;
  refreshBtn.x = width - UI.margin - refreshBtn.w;
  refreshBtn.y = UI.margin + 12;
}

/* =========================
   DATA LOADING
========================= */
function loadInitialData() {
  if (USE_API) fetchAndUpdate("Initial load");
  else {
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
  // Normalize first, then filter out literal "null" string
  entries = rawData.map(normalizeEntry).filter((d) => d.note !== "null");

  // Stable order: event_id ascending (so latest-first just reverses)
  entries.sort((a, b) => (a.event_id || 0) - (b.event_id || 0));
  validEntryIndex = entries.map((_, i) => i);

  const maxId = entries.reduce((m, d) => max(m, d.event_id || 0), 0);
  const was = lastMaxEventId;
  lastMaxEventId = maxId;

  if (USE_API && maxId > was && was !== 0) {
    statusMsg = `✅ New entry: event_id ${maxId}`;
  } else {
    statusMsg = `${reason}. Entries: ${entries.length}. Latest: ${
      maxId || "—"
    }`;
  }
}

function normalizeEntry(d) {
  const note = (d.note ?? "").toString();
  return {
    created_at: d.created_at ?? "",
    event_id: safeInt(d.event_id),
    temp_c: safeFloat(d.temp_c),
    humidity_pct: safeFloat(d.humidity_pct),
    sound_loudness: safeFloat(d.sound_loudness),
    note,
    note_word_count: wordCount(note),
    photo_url: (d.photo_url ?? "").toString(),
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
   REFRESH + POLLING
========================= */
function startRefreshAction() {
  if (!USE_API) {
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

    if (millis() - pollStartMs >= POLL_TOTAL_MS) {
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

  // "hover" is mostly irrelevant on phone but harmless on desktop
  const hovering = isPointInRect(mouseX, mouseY, refreshBtn);

  stroke(T.btnStroke);
  strokeWeight(1);
  fill(hovering ? T.btnFillHover : T.btnFill);
  rect(x, y, w, h, UI.btnRadius);

  noStroke();
  fill(T.text);
  textAlign(CENTER, CENTER);
  textSize(UI.btnTextSize);

  let label = "Refresh";
  if (!USE_API) label = "Reload";
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
    noStroke();
    fill(T.subtext);
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
    stroke(T.ink);
    strokeWeight(2);
    strokeCap(SQUARE);
    line(UI.margin, yPx, width - UI.margin, yPx);
  }

  for (let k = 0; k < displayIndices.length; k++) {
    const entryIdx = displayIndices[k];
    const d = entries[entryIdx];

    // Relative humidity ring diameter in local units
    const hum = constrain(d.humidity_pct, 0, 100);
    const humGap = map(hum, 0, 100, UI.humGapMin, UI.humGapMax);
    const humDiaLocal = UI.tempDia + 2 * humGap;

    // Convert local diameter -> pixels using height-based scale
    const sFromH = UI.cellH / 100;
    const ringDiameterPx = humDiaLocal * sFromH;

    // Variable width
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
   - geometry in centered uniform-scaled 100x100
   - text in pixel space (uniform size)
========================= */
function drawCell(d, x, y, w, h, entryIndex, baselineYpx) {
  const T = theme();

  // Cell background
  noStroke();
  fill(T.panel);
  rect(x, y, w, h);

  // Uniform scale so circles stay circles
  const SCALE = min(w, h) / 100;

  // Center the 100x100 design space inside the rectangle
  const DX = (w - 100 * SCALE) / 2;
  const DY = (h - 100 * SCALE) / 2;

  // Baseline px -> local (0..100)
  const baselineLocalY = (baselineYpx - (y + DY)) / SCALE;

  // Stem height from note word count
  const wc = constrain(d.note_word_count, 0, 60);
  const stemTopLocalY = baselineLocalY - wc;

  // Humidity ring as "gap thickness" outside temp circle
  const hum = constrain(d.humidity_pct, 0, 100);
  const humGap = map(hum, 0, 100, UI.humGapMin, UI.humGapMax);
  const humDia = UI.tempDia + 2 * humGap;

  // --- Geometry (local space) ---
  push();
  translate(x + DX, y + DY);
  scale(SCALE);

  // Stem
  stroke(T.ink);
  strokeWeight(2);
  line(50, baselineLocalY, 50, stemTopLocalY);

  // Temp circle (color from temp_c)
  colorMode(HSB, 360, 100, 100, 1);
  const hue = map(constrain(d.temp_c, -10, 35), -10, 35, 220, 20);
  noStroke();
  fill(hue, 80, 90, 1);
  circle(50, stemTopLocalY, UI.tempDia);
  colorMode(RGB, 255);

  // Humidity ring
  noFill();
  stroke(T.ink);
  strokeWeight(2);
  circle(50, stemTopLocalY, humDia);

  // Mask under baseline (blocks anything under baseline)
  noStroke();
  fill(T.panel);
  rect(0, baselineLocalY, 100, 25);

  pop();

  // --- Text (pixel space) ---
  const cx = x + w / 2;

  fill(T.text);
  noStroke();
  textAlign(CENTER, CENTER);

  // Event ID below baseline
  textSize(UI.textEventSize);
  text(`${d.event_id}`, cx, baselineYpx + 26);

  // Add-note reminder: above circle, follows stem top
  if ((d.note ?? "").trim() === "") {
    const reminderYLocal = stemTopLocalY - UI.reminderOffsetLocal;
    const reminderYpx = y + DY + reminderYLocal * SCALE;

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
  const pad = UI.modalPad;
  const cardW = width - pad * 2;
  const cardH = height - pad * 2;

  fill(T.panel);
  rect(pad, pad, cardW, cardH, 16);

  // Close button
  const closeSize = UI.modalCloseSize;
  const closeX = pad + cardW - closeSize - 10;
  const closeY = pad + 10;

  stroke(T.btnStroke);
  strokeWeight(1);
  fill(T.btnFill);
  rect(closeX, closeY, closeSize, closeSize, UI.modalCloseRadius);

  noStroke();
  fill(T.text);
  textAlign(CENTER, CENTER);
  textSize(UI.btnTextSize);
  text("✕", closeX + closeSize / 2, closeY + closeSize / 2);

  // Text content
  const x = pad + 18;
  let y = pad + 18;

  fill(T.text);
  textAlign(LEFT, TOP);

  textSize(UI.modalTitleSize);
  text(`event_id: ${d.event_id}`, x, y);
  y += UI.modalTitleSize + 6;

  fill(T.subtext);
  textSize(UI.modalMetaSize);
  text(`created_at: ${d.created_at}`, x, y);
  y += UI.modalMetaSize + 14;

  fill(T.text);
  textSize(UI.modalLineSize);
  text(`Temp (°C): ${d.temp_c}`, x, y);
  y += UI.modalLineSize + 8;
  text(`Humidity (%): ${d.humidity_pct}`, x, y);
  y += UI.modalLineSize + 8;
  text(`Sound loudness: ${d.sound_loudness}`, x, y);
  y += UI.modalLineSize + 8;
  text(`Note word count: ${d.note_word_count}`, x, y);
  y += UI.modalLineSize + 14;

  // Note box
  textSize(UI.modalNoteLabelSize);
  text("Note:", x, y);
  y += UI.modalNoteLabelSize + 8;

  const noteBoxW = cardW - 36;
  const noteBoxH = UI.modalNoteBoxH;

  stroke(T.ink);
  strokeWeight(1);
  noFill();
  rect(x, y, noteBoxW, noteBoxH, 10);

  noStroke();
  fill(T.text);
  textSize(UI.modalNoteTextSize);

  const noteText =
    (d.note ?? "").trim() === "" ? "(empty — submit via Google Form)" : d.note;

  text(noteText, x + 10, y + 10, noteBoxW - 20, noteBoxH - 20);
  y += noteBoxH + 16;

  // Photo URL
  fill(T.text);
  textSize(UI.modalPhotoLabelSize);
  text("photo_url:", x, y);
  y += UI.modalPhotoLabelSize + 6;

  textSize(UI.modalPhotoTextSize);
  fill(T.link[0], T.link[1], T.link[2]);
  text(d.photo_url || "(none)", x, y, noteBoxW, 60);

  // Store close bounds for interaction
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
    return false; // prevent page scroll
  }
}

function handlePress(px, py) {
  // Modal close
  if (selectedIndex >= 0) {
    const d = entries[selectedIndex];
    if (d.__closeBounds && isPointInRect(px, py, d.__closeBounds)) {
      selectedIndex = -1;
    }
    return;
  }

  // Refresh button
  if (isPointInRect(px, py, refreshBtn)) {
    startRefreshAction();
    return;
  }

  // Cell hit test
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

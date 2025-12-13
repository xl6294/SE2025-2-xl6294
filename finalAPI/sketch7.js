/*******************************************************
 * P5.js — Environmental Snapshot Viewer (Mobile-first)
 * Complete sketch.js (theme-fixed)
 *
 * Fixes:
 * - Cell background, baseline, stem, humidity ring outline, and text
 *   now ALL respond to LIGHT_MODE via theme().
 *******************************************************/

/* =========================
   MODE SWITCHES
========================= */
const USE_API = false; // <-- set true when you want to use Apps Script
const LIGHT_MODE = true; // <-- false = dark
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
      panel: bg, // ✅ make cells match page background
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
    panel: bg, // ✅ make cells match page background
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
  margin: 12,

  topBarH: 70,

  cellH: 110,
  baselinePx: 75,
  rowGap: 0,
  sidePad: 8,
  minW: 78,
  maxW: 190,

  // Geometry in local 100×100 space
  tempDia: 14,
  humGapMin: 1,
  humGapMax: 12,

  // Text sizes (pixel space)
  textEventSize: 18,
  textNoteSize: 14,
  textArrowSize: 18,

  reminderOffsetLocal: 24,

  // inside UI_BASE
  btnW: 80,
  btnH: 40,
  btnRadius: 12,
  btnTextSize: 16,
};

// We'll overwrite this at runtime based on screen size
let UI = { ...UI_BASE };

function applyResponsiveUI() {
  // Scale up on small screens; mild scale on larger screens
  const refW = 390; // iPhone-ish reference width
  const s = constrain(width / refW, 1.0, 1.6); // bump up to 1.6x on phones
  // ^ If it still feels small, increase the last clamp

  UI = {
    ...UI_BASE,
    margin: UI_BASE.margin, // keep your margin stable like you wanted

    topBarH: round(UI_BASE.topBarH * s),

    cellH: round(UI_BASE.cellH * s),
    baselinePx: round(UI_BASE.baselinePx * s),

    sidePad: round(UI_BASE.sidePad * s),
    minW: round(UI_BASE.minW * s),
    maxW: round(UI_BASE.maxW * s),

    tempDia: round(UI_BASE.tempDia * s),

    // Keep humidity “gap” feeling consistent (local units), or scale slightly:
    humGapMin: UI_BASE.humGapMin,
    humGapMax: UI_BASE.humGapMax,

    textEventSize: round(UI_BASE.textEventSize * s),
    textNoteSize: round(UI_BASE.textNoteSize * s),
    textArrowSize: round(UI_BASE.textArrowSize * s),

    reminderOffsetLocal: UI_BASE.reminderOffsetLocal,
    rowGap: UI_BASE.rowGap,

    // ✅ button scaling
    btnW: round(UI_BASE.btnW * s),
    btnH: round(UI_BASE.btnH * s),
    btnRadius: round(UI_BASE.btnRadius * s),
    btnTextSize: round(UI_BASE.btnTextSize * s),
  };
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

  applyResponsiveUI(); // ✅ add
  setupRefreshButton();
  loadInitialData();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  applyResponsiveUI(); // ✅ add
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
  refreshBtn.y = UI.margin + 12; // stays near top bar
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
    const url = `${GAS_GET_URL}?t=${Date.now()}`;
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
  entries = rawData.map(normalizeEntry).filter((d) => d.note !== "null");

  // stable order for “latest first” via reverse()
  entries.sort((a, b) => (a.event_id || 0) - (b.event_id || 0));
  validEntryIndex = entries.map((_, i) => i);

  const maxId = entries.reduce((m, d) => max(m, d.event_id || 0), 0);
  const was = lastMaxEventId;
  lastMaxEventId = maxId;

  if (USE_API && maxId > was && was !== 0)
    statusMsg = `✅ New entry: event_id ${maxId}`;
  else
    statusMsg = `${reason}. Entries: ${entries.length}. Latest: ${
      maxId || "—"
    }`;
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
  const hovering = isPointInRect(mouseX, mouseY, refreshBtn);

  // Button shape
  stroke(T.btnStroke);
  strokeWeight(1);
  fill(hovering ? T.btnFillHover : T.btnFill);
  rect(x, y, w, h, UI.btnRadius); // 👈 responsive radius

  // Button label
  noStroke();
  fill(T.text);
  textAlign(CENTER, CENTER);
  textSize(UI.btnTextSize); // 👈 larger + responsive

  let label = "Refresh";
  if (!USE_API) label = "Reload";
  else if (polling) label = "Checking…";

  text(label, x + w / 2, y + h / 2);
}

/* =========================
   DRAW: FLOW GRID (Option B)
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

  let displayIndices = validEntryIndex.slice();
  if (SHOW_LATEST_FIRST) displayIndices.reverse();

  let cursorX = UI.margin;
  let cursorY = topOffset;
  let rowBaselineY = cursorY + UI.baselinePx;

  function drawRowBaseline(yPx) {
    stroke(T.ink); // ✅ theme-driven
    strokeWeight(2);
    strokeCap(SQUARE);
    line(UI.margin, yPx, width - UI.margin, yPx);
  }

  for (let k = 0; k < displayIndices.length; k++) {
    const entryIdx = displayIndices[k];
    const d = entries[entryIdx];

    // humidity ring size (relative to temp circle)
    const hum = constrain(d.humidity_pct, 0, 100);
    const humGap = map(hum, 0, 100, UI.humGapMin, UI.humGapMax);
    const humDiaLocal = UI.tempDia + 2 * humGap;

    const sFromH = UI.cellH / 100;
    const ringDiameterPx = humDiaLocal * sFromH;

    let cellW = ringDiameterPx + UI.sidePad * 2 + 40;
    cellW = constrain(cellW, UI.minW, UI.maxW);

    const rightLimit = width - UI.margin;

    if (cursorX + cellW > rightLimit) {
      drawRowBaseline(rowBaselineY);
      cursorX = UI.margin;
      cursorY += UI.cellH + UI.rowGap;
      rowBaselineY = cursorY + UI.baselinePx;
    }

    drawCell(d, cursorX, cursorY, cellW, UI.cellH, entryIdx, rowBaselineY);
    cursorX += cellW;
  }

  drawRowBaseline(rowBaselineY);
}

/* =========================
   DRAW: SINGLE CELL
========================= */
function drawCell(d, x, y, w, h, entryIndex, baselineYpx) {
  const T = theme();

  // Cell background ✅ theme-driven
  noStroke();
  fill(T.panel);
  rect(x, y, w, h);

  // Uniform scale so circles stay circles
  const SCALE = min(w, h) / 100;
  const DX = (w - 100 * SCALE) / 2;
  const DY = (h - 100 * SCALE) / 2;

  const baselineLocalY = (baselineYpx - (y + DY)) / SCALE;

  const wc = constrain(d.note_word_count, 0, 60);
  const stemTopLocalY = baselineLocalY - wc;

  const hum = constrain(d.humidity_pct, 0, 100);
  const humGap = map(hum, 0, 100, UI.humGapMin, UI.humGapMax);
  const humDia = UI.tempDia + 2 * humGap;

  // Geometry (local 100x100)
  push();
  translate(x + DX, y + DY);
  scale(SCALE);

  // Stem ✅ theme-driven
  stroke(T.ink);
  strokeWeight(2);
  line(50, baselineLocalY, 50, stemTopLocalY);

  // Temp circle (color)
  colorMode(HSB, 360, 100, 100, 1);
  const hue = map(constrain(d.temp_c, -10, 35), -10, 35, 220, 20);
  noStroke();
  fill(hue, 80, 90, 1);
  circle(50, stemTopLocalY, UI.tempDia);
  colorMode(RGB, 255);

  // Humidity ring ✅ theme-driven
  noFill();
  stroke(T.ink);
  strokeWeight(2);
  circle(50, stemTopLocalY, humDia);

  // Mask below baseline ✅ theme-driven
  noStroke();
  fill(T.panel);
  rect(0, baselineLocalY, 100, 25);

  pop();

  // Text (pixel space) ✅ theme-driven
  const cx = x + w / 2;

  fill(T.text);
  noStroke();
  textAlign(CENTER, CENTER);

  textSize(UI.textEventSize);
  text(`${d.event_id}`, cx, baselineYpx + 26);

  if ((d.note ?? "").trim() === "") {
    const reminderYLocal = stemTopLocalY - UI.reminderOffsetLocal;
    const reminderYpx = y + DY + reminderYLocal * SCALE;

    textSize(UI.textNoteSize);
    text("add note", cx, reminderYpx - 20);

    textSize(UI.textArrowSize);
    text("↓", cx, reminderYpx);
  }

  d.__cellBounds = { x, y, w, h, entryIndex };
}

/* =========================
   MODAL DETAIL VIEW
========================= */
function drawModal(d) {
  const T = theme();

  noStroke();
  fill(T.overlay[0], T.overlay[1]);
  rect(0, 0, width, height);

  const pad = 16;
  const cardW = width - pad * 2;
  const cardH = height - pad * 2;

  fill(T.panel);
  rect(pad, pad, cardW, cardH, 16);

  const closeSize = 34;
  const closeX = pad + cardW - closeSize - 10;
  const closeY = pad + 10;

  fill(T.ink);
  rect(closeX, closeY, closeSize, closeSize, 10);

  fill(T.panel);
  textAlign(CENTER, CENTER);
  textSize(16);
  text("✕", closeX + closeSize / 2, closeY + closeSize / 2);

  fill(T.text);
  textAlign(LEFT, TOP);

  const x = pad + 18;
  let y = pad + 18;

  textSize(18);
  text(`event_id: ${d.event_id}`, x, y);
  y += 26;

  textSize(12);
  fill(T.subtext);
  text(`created_at: ${d.created_at}`, x, y);
  y += 22;

  fill(T.text);
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
  stroke(T.ink);
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

  d.__closeBounds = { x: closeX, y: closeY, w: closeSize, h: closeSize };
}

/* =========================
   INTERACTION
========================= */
function mousePressed() {
  handlePress(mouseX, mouseY);
}

function touchStarted() {
  if (touches && touches.length > 0) {
    handlePress(touches[0].x, touches[0].y);
    return false;
  }
}

function handlePress(px, py) {
  if (selectedIndex >= 0) {
    const d = entries[selectedIndex];
    if (d.__closeBounds && isPointInRect(px, py, d.__closeBounds))
      selectedIndex = -1;
    return;
  }

  if (isPointInRect(px, py, refreshBtn)) {
    startRefreshAction();
    return;
  }

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

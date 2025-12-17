/*******************************************************
 * P5.js — Environmental Snapshot Viewer (PHONE-ONLY)
 * Complete sketch.js (clean + theme-aware + mobile sizing)
 *
 * Fixes:
 * - Removes broken/duplicated code sections (e.g. "ffunction drawModal")
 * - UI scaling is ALWAYS treated as mobile (no desktop branch)
 * - All ink/text/panel/baseline colors respond to LIGHT_MODE via theme()
 *******************************************************/

/* =========================
   MODE SWITCHES
========================= */
let USE_API = false; // true = Apps Script endpoint, false = mock data
let LIGHT_MODE = true; // true = light, false = dark
const SHOW_LATEST_FIRST = true;

// Apps Script Web App URL (doGet returns array of events)
const GAS_GET_URL =
  "https://script.google.com/macros/s/AKfycbyrm87nzk47xy1s7ojSL0HR44Ml9KwUk7RAqYcofmQzEBHp99Rd1hZva3KziSVrbR93/exec";

// Polling burst after refresh (API mode only)
const POLL_INTERVAL_MS = 3000;
const POLL_TOTAL_MS = 15000;

/* =========================
   PHONE-ONLY SIZE CONTROL
   - If it feels too big, lower UI_SCALE (ex: 1.25)
   - If still too small, raise UI_SCALE (ex: 1.5)
========================= */
const UI_SCALE = 1.35;

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
  }, // empty note should show reminder
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
========================= */
function theme() {
  if (LIGHT_MODE) {
    const bg = 245;
    return {
      bg,
      topBar: 235,
      panel: bg, // same as bg (no mismatch)
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
    panel: bg,
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
   LAYOUT / TUNING KNOBS (BASE)
   - We scale pixel-based UI by UI_SCALE in applyMobileUI()
   - “local 100x100 geometry” stays unscaled so the drawing logic stays stable
========================= */
const UI_BASE = {
  margin: 12,
  topBarH: 70,

  // Grid flow
  cellH: 110,
  baselinePx: 75,
  rowGap: 0,
  sidePad: 8,
  minW: 78,
  maxW: 190,

  // Geometry in local 100×100 design space (KEEP UN-SCALED)
  tempDia: 14,
  humGapMin: 1,
  humGapMax: 12,
  reminderOffsetLocal: 24,

  // Text sizes (pixel space)
  textEventSize: 18,
  textNoteSize: 14,
  textArrowSize: 18,

  // Button (pixel space)
  btnW: 90,
  btnH: 44,
  btnRadius: 12,
  btnTextSize: 16,

  topBarH: 96, // total top bar height (2 rows)
  topBarRowH: 48, // height of row 1 (buttons)
  topBarPadX: 12,
  topBarPadY: 10,
  btnGap: 10,
  btnW2: 86, // width of the small toggle buttons

  // Modal sizing (pixel space)
  modalPad: 16,
  modalCloseSize: 36,
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

// Active UI (scaled)
let UI = { ...UI_BASE };

function applyMobileUI() {
  // Scale ONLY pixel-based layout knobs
  UI = { ...UI_BASE };

  const s = UI_SCALE;

  // pixel-space scale
  UI.margin = round(UI_BASE.margin * s);
  UI.topBarH = round(UI_BASE.topBarH * s);

  UI.cellH = round(UI_BASE.cellH * s);
  UI.baselinePx = round(UI_BASE.baselinePx * s);
  UI.rowGap = round(UI_BASE.rowGap * s);
  UI.sidePad = round(UI_BASE.sidePad * s);
  UI.minW = round(UI_BASE.minW * s);
  UI.maxW = round(UI_BASE.maxW * s);

  UI.textEventSize = round(UI_BASE.textEventSize * s);
  UI.textNoteSize = round(UI_BASE.textNoteSize * s);
  UI.textArrowSize = round(UI_BASE.textArrowSize * s);

  UI.btnW = round(UI_BASE.btnW * s);
  UI.btnH = round(UI_BASE.btnH * s);
  UI.btnRadius = round(UI_BASE.btnRadius * s);
  UI.btnTextSize = round(UI_BASE.btnTextSize * s);

  UI.modalPad = round(UI_BASE.modalPad * s);
  UI.modalCloseSize = round(UI_BASE.modalCloseSize * s);
  UI.modalCloseRadius = round(UI_BASE.modalCloseRadius * s);
  UI.modalTitleSize = round(UI_BASE.modalTitleSize * s);
  UI.modalMetaSize = round(UI_BASE.modalMetaSize * s);
  UI.modalLineSize = round(UI_BASE.modalLineSize * s);
  UI.modalNoteLabelSize = round(UI_BASE.modalNoteLabelSize * s);
  UI.modalNoteTextSize = round(UI_BASE.modalNoteTextSize * s);
  UI.modalNoteBoxH = round(UI_BASE.modalNoteBoxH * s);
  UI.modalPhotoLabelSize = round(UI_BASE.modalPhotoLabelSize * s);
  UI.modalPhotoTextSize = round(UI_BASE.modalPhotoTextSize * s);

  // keep margin sane
  UI.margin = constrain(UI.margin, 10, 24);

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

let btnReload = { x: 0, y: 0, w: 0, h: 0 };
let btnMode = { x: 0, y: 0, w: 0, h: 0 }; // API/Mock
let btnTheme = { x: 0, y: 0, w: 0, h: 0 }; // Light/Dark

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

  applyMobileUI();
  setupRefreshButton();
  loadInitialData();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  applyMobileUI();
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
  const padX = UI.topBarPadX ?? UI.margin;
  const padY = UI.topBarPadY ?? 10;

  const h = UI.btnH;
  const y = padY;

  // widths
  const wReload = UI.btnW;
  const wSmall = UI.btnW2 ?? 86;
  const gap = UI.btnGap ?? 10;

  // Right-aligned group: [Theme][Mode][Reload]
  const rightEdge = width - padX;

  btnReload.w = wReload;
  btnReload.h = h;
  btnMode.w = wSmall;
  btnMode.h = h;
  btnTheme.w = wSmall;
  btnTheme.h = h;

  btnReload.x = rightEdge - wReload;
  btnMode.x = btnReload.x - gap - wSmall;
  btnTheme.x = btnMode.x - gap - wSmall;

  btnReload.y = y;
  btnMode.y = y;
  btnTheme.y = y;
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
  // Filter out ONLY the string "null"
  entries = rawData.map(normalizeEntry).filter((d) => d.note !== "null");

  // stable order for latest-first (reverse() later)
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
    created_at: (d.created_at ?? "").toString(),
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

  // Top bar background (solid, no overlay)
  noStroke();
  fill(T.topBar);
  rect(0, 0, width, UI.topBarH);

  // Title (left)
  fill(T.text);
  textAlign(LEFT, CENTER);
  textSize(16);
  text("Environmental Snapshot Viewer", UI.margin, (UI.topBarRowH ?? 48) / 2);

  // Buttons (row 1)
  drawButton(btnTheme, LIGHT_MODE ? "Light" : "Dark");
  drawButton(btnMode, USE_API ? "API" : "Mock");
  drawButton(
    btnReload,
    USE_API ? (polling ? "Checking" : "Refresh") : "Reload"
  );

  // Info row (row 2)
  const infoY = (UI.topBarRowH ?? 48) + 20;
  fill(T.subtext);
  textAlign(LEFT, CENTER);
  textSize(12);
  text(statusMsg, UI.margin, infoY);
}

function drawButton(btn, label) {
  const T = theme();
  const hovering = isPointInRect(mouseX, mouseY, btn);

  stroke(T.btnStroke);
  strokeWeight(1);
  fill(hovering ? T.btnFillHover : T.btnFill);
  rect(btn.x, btn.y, btn.w, btn.h, UI.btnRadius);

  noStroke();
  fill(T.text);
  textAlign(CENTER, CENTER);
  textSize(UI.btnTextSize);
  text(label, btn.x + btn.w / 2, btn.y + btn.h / 2);
}

/* =========================
   DRAW: FLOW GRID (Option B)
   - variable widths driven by humidity ring size (relative ring)
   - wraps rows
   - continuous baseline per row (margin-to-margin)
========================= */
function drawGrid() {
  const T = theme();
  const topOffset = UI.topBarH + UI.margin;

  if (!entries.length) {
    noStroke();
    fill(T.subtext);
    textAlign(CENTER, CENTER);
    textSize(round(14 * UI_SCALE));
    text("No entries yet (or all filtered).", width / 2, height / 2);
    return;
  }

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

    // humidity ring diameter (local units), relative to temp circle
    const hum = constrain(d.humidity_pct, 0, 100);
    const humGap = map(hum, 0, 100, UI.humGapMin, UI.humGapMax);
    const humDiaLocal = UI.tempDia + 2 * humGap;

    // Convert local diameter -> pixels (based on cell height)
    const sFromH = UI.cellH / 100;
    const ringDiameterPx = humDiaLocal * sFromH;

    // variable width: ring + padding + breathing room
    let cellW = ringDiameterPx + UI.sidePad * 2 + 40;
    cellW = constrain(cellW, UI.minW, UI.maxW);

    const rightLimit = width - UI.margin;

    // wrap row
    if (cursorX + cellW > rightLimit) {
      drawRowBaseline(rowBaselineY);

      cursorX = UI.margin;
      cursorY += UI.cellH + UI.rowGap;
      rowBaselineY = cursorY + UI.baselinePx;
    }

    drawCell(d, cursorX, cursorY, cellW, UI.cellH, entryIdx, rowBaselineY);
    cursorX += cellW;
  }

  // baseline for last row
  drawRowBaseline(rowBaselineY);
}

/* =========================
   DRAW: SINGLE CELL
   - geometry drawn in centered uniform-scaled 100x100 space
   - text drawn in pixel space (uniform sizes)
========================= */
function drawCell(d, x, y, w, h, entryIndex, baselineYpx) {
  const T = theme();

  // cell background
  noStroke();
  fill(T.panel);
  rect(x, y, w, h);

  // uniform scale so circles stay circles
  const SCALE = min(w, h) / 100;
  const DX = (w - 100 * SCALE) / 2;
  const DY = (h - 100 * SCALE) / 2;

  // baseline px -> local
  const baselineLocalY = (baselineYpx - (y + DY)) / SCALE;

  // stem height from note word count
  const wc = constrain(d.note_word_count, 0, 60);
  const stemTopLocalY = baselineLocalY - wc;

  // humidity ring as “gap thickness” outside temp circle
  const hum = constrain(d.humidity_pct, 0, 100);
  const humGap = map(hum, 0, 100, UI.humGapMin, UI.humGapMax);
  const humDia = UI.tempDia + 2 * humGap;

  // geometry in local space
  push();
  translate(x + DX, y + DY);
  scale(SCALE);

  // stem
  stroke(T.ink);
  strokeWeight(2);
  line(50, baselineLocalY, 50, stemTopLocalY);

  // temp circle color (HSB hue mapped from temp_c)
  colorMode(HSB, 360, 100, 100, 1);
  const hue = map(constrain(d.temp_c, -10, 35), -10, 35, 220, 20);
  noStroke();
  fill(hue, 80, 90, 1);
  circle(50, stemTopLocalY, UI.tempDia);
  colorMode(RGB, 255);

  // humidity ring
  noFill();
  stroke(T.ink);
  strokeWeight(2);
  circle(50, stemTopLocalY, humDia);

  // mask below baseline (blocks geometry under baseline)
  noStroke();
  fill(T.panel);
  rect(0, baselineLocalY, 100, 25);

  pop();

  // text in pixel space
  const cx = x + w / 2;

  fill(T.text);
  noStroke();
  textAlign(CENTER, CENTER);

  textSize(UI.textEventSize);
  text(`${d.event_id}`, cx, baselineYpx + round(26 * UI_SCALE));

  // add note reminder for empty note
  if ((d.note ?? "").trim() === "") {
    const reminderYLocal = stemTopLocalY - UI.reminderOffsetLocal;
    const reminderYpx = y + DY + reminderYLocal * SCALE;

    textSize(UI.textNoteSize);
    text("add note", cx, reminderYpx - round(20 * UI_SCALE));

    textSize(UI.textArrowSize);
    text("↓", cx, reminderYpx);
  }

  // click bounds
  d.__cellBounds = { x, y, w, h, entryIndex };
}

/* =========================
   MODAL DETAIL VIEW
========================= */
function drawModal(d) {
  const T = theme();

  // dim overlay
  noStroke();
  fill(T.overlay[0], T.overlay[1]);
  rect(0, 0, width, height);

  // card
  const pad = UI.modalPad;
  const cardW = width - pad * 2;
  const cardH = height - pad * 2;

  fill(T.panel);
  rect(pad, pad, cardW, cardH, 16);

  // close button
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

  // text content
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

  // note box
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

  // photo url
  fill(T.text);
  textSize(UI.modalPhotoLabelSize);
  text("photo_url:", x, y);
  y += UI.modalPhotoLabelSize + 6;

  textSize(UI.modalPhotoTextSize);
  fill(T.link[0], T.link[1], T.link[2]);
  text(d.photo_url || "(none)", x, y, noteBoxW, 60);

  // store close bounds for interaction
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
  }
  return false; // ✅ VERY IMPORTANT
}

function handlePress(px, py) {
  // modal open?
  if (selectedIndex >= 0) {
    const d = entries[selectedIndex];
    if (d.__closeBounds && isPointInRect(px, py, d.__closeBounds)) {
      selectedIndex = -1;
    }
    return;
  }

  // refresh button
  if (isPointInRect(px, py, btnReload)) {
    startRefreshAction();
    return;
  }

  if (isPointInRect(px, py, btnMode)) {
    USE_API = !USE_API;
    selectedIndex = -1;
    stopPollingBurst();
    loadInitialData();
    return;
  }

  if (isPointInRect(px, py, btnTheme)) {
    LIGHT_MODE = !LIGHT_MODE;
    return;
  }

  // cells
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

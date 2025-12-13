/*******************************************************
 * P5.js — Environmental Snapshot Viewer (Mobile-first)
 *
 * Two modes:
 *   A) API mode (Apps Script doGet)
 *   B) Mock mode (local fake JSON)
 *
 * Switch modes by editing ONE line:
 *   const USE_API = false;  // mock
 *   const USE_API = true;   // API
 *
 * Behavior rules:
 * - FILTER OUT only note === "null" (string)
 * - KEEP empty note ""  (so new entries still show up)
 * - Compute note word count (empty note => 0)
 * - Grid cell tap opens full-screen modal (no scrolling)
 * - Manual Refresh button:
 *     - in API mode: fetch now, then poll every 3s for 15s
 *     - in MOCK mode: just reload mock data (no polling needed)
 *******************************************************/

/*******************************************************
 * MODE SWITCH
 *******************************************************/
const USE_API = false; // <-- CHANGE THIS: false = mock, true = API

// Only needed if USE_API === true
const GAS_GET_URL =
  "https://script.google.com/macros/s/PASTE_YOUR_EXEC_URL_HERE/exec";

/*******************************************************
 * MOCK DATA (used when USE_API === false)
 *******************************************************/
const mockData = [
  {
    created_at: "2025-12-12T08:12:05",
    event_id: 1,
    temp_c: 21.8,
    humidity_pct: 17.0,
    sound_loudness: 6,
    note: "Quiet morning at home—heater is on.",
    photo_url: "",
  },
  {
    created_at: "2025-12-12T08:48:33",
    event_id: 2,
    temp_c: 19.6,
    humidity_pct: 24.0,
    sound_loudness: 18,
    note: "null",
    photo_url: "",
  },
  {
    created_at: "2025-12-12T10:05:41",
    event_id: 3,
    temp_c: 6.2,
    humidity_pct: 72.0,
    sound_loudness: 22,
    note: "Outside walk—cold air, damp wind, traffic in the distance.",
    photo_url: "",
  },
  {
    created_at: "2025-12-12T11:22:19",
    event_id: 4,
    temp_c: 0.8,
    humidity_pct: 81.0,
    sound_loudness: 35,
    note: "On the street corner—cars, subway rumble underfoot.",
    photo_url: "",
  },
  {
    created_at: "2025-12-12T12:10:07",
    event_id: 5,
    temp_c: 23.4,
    humidity_pct: 14.5,
    sound_loudness: 10,
    note: "Very dry indoor air—felt like my lips were cracking.",
    photo_url: "",
  },
  {
    created_at: "2025-12-12T13:37:52",
    event_id: 6,
    temp_c: 16.1,
    humidity_pct: 38.0,
    sound_loudness: 54,
    note: "Cafeteria / lounge—lots of voices bouncing around.",
    photo_url: "",
  },
  {
    created_at: "2025-12-12T15:03:11",
    event_id: 7,
    temp_c: -3.4,
    humidity_pct: 64.0,
    sound_loudness: 27,
    note: "Snowy sidewalk—quiet but crunchy footsteps.",
    photo_url: "",
  },
  {
    created_at: "2025-12-12T16:18:26",
    event_id: 8,
    temp_c: 9.7,
    humidity_pct: 58.0,
    sound_loudness: 76,
    note: "Near a busy intersection—sirens + buses + crosswalk beeps.",
    photo_url: "",
  },
  {
    created_at: "2025-12-12T18:02:40",
    event_id: 9,
    temp_c: 20.2,
    humidity_pct: 28.0,
    sound_loudness: 12,
    note: "",
    photo_url: "",
  },
  {
    created_at: "2025-12-12T20:44:18",
    event_id: 10,
    temp_c: 24.9,
    humidity_pct: 33.0,
    sound_loudness: 92,
    note: "Crowded indoor chat—music + people talking over each other.",
    photo_url: "",
  },
];

/*******************************************************
 * POLLING (API mode only)
 *******************************************************/
const POLL_INTERVAL_MS = 3000;
const POLL_TOTAL_MS = 15000;

/*******************************************************
 * LAYOUT
 *******************************************************/
let cellSize;
let cols, rows;
let margin = 12;

/*******************************************************
 * DATA
 *******************************************************/
let rawData = [];
let entries = [];
let lastMaxEventId = 0;
let validEntryIndex = [];

/*******************************************************
 * UI STATE
 *******************************************************/
let selectedIndex = -1;
let statusMsg = "Not loaded yet.";
let isFetching = false;

/*******************************************************
 * Refresh + polling state
 *******************************************************/
let polling = false;
let pollTimer = null;
let pollStartMs = 0;
let pollTicks = 0;

/*******************************************************
 * Simple refresh button bounds
 *******************************************************/
let refreshBtn = { x: 0, y: 0, w: 120, h: 40 };

/*******************************************************
 * SETUP
 *******************************************************/
function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("system-ui");

  computeLayout();
  setupRefreshButton();

  // Initial load
  loadData("Initial load");
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  computeLayout();
  setupRefreshButton();
}

/*******************************************************
 * DRAW
 *******************************************************/
function draw() {
  background(0);
  drawTopBar();
  drawGrid();

  if (selectedIndex >= 0) {
    drawModal(entries[selectedIndex]);
  }
}

/*******************************************************
 * MODE-AWARE LOADING
 *******************************************************/
function loadData(reason = "manual") {
  if (USE_API) {
    fetchAndUpdate(reason);
  } else {
    loadMock(reason);
  }
}

/*******************************************************
 * MOCK LOADER
 *******************************************************/
function loadMock(reason = "mock") {
  statusMsg = `Loaded mock data. (${reason})`;

  rawData = Array.isArray(mockData) ? mockData : [];
  entries = rawData.map(normalizeEntry).filter((d) => d.note !== "null");

  entries.sort((a, b) => (a.event_id || 0) - (b.event_id || 0));
  validEntryIndex = entries.map((_, i) => i);

  const maxId = entries.reduce((m, d) => max(m, d.event_id || 0), 0);
  lastMaxEventId = maxId;

  statusMsg = `MOCK: ${entries.length} entries. Latest event_id: ${
    maxId || "—"
  }`;
}

/*******************************************************
 * API FETCHER
 *******************************************************/
async function fetchAndUpdate(reason = "manual") {
  if (!GAS_GET_URL || GAS_GET_URL.includes("PASTE_YOUR")) {
    statusMsg = "Set GAS_GET_URL in sketch.js first.";
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

    // Keep empty notes, skip only note === "null"
    entries = rawData.map(normalizeEntry).filter((d) => d.note !== "null");

    entries.sort((a, b) => (a.event_id || 0) - (b.event_id || 0));
    validEntryIndex = entries.map((_, i) => i);

    const maxId = entries.reduce((m, d) => max(m, d.event_id || 0), 0);
    const was = lastMaxEventId;
    lastMaxEventId = maxId;

    if (maxId > was && was !== 0) {
      statusMsg = `✅ New entry detected: event_id ${maxId}`;
    } else {
      statusMsg = `Loaded ${entries.length} entries. Latest event_id: ${
        maxId || "—"
      }`;
    }
  } catch (err) {
    statusMsg = `Fetch error: ${String(err)}`;
  } finally {
    isFetching = false;
  }
}

/*******************************************************
 * DATA NORMALIZATION + WORD COUNT
 *******************************************************/
function normalizeEntry(d) {
  const eventId = safeInt(d.event_id);
  const tempC = safeFloat(d.temp_c);
  const humidity = safeFloat(d.humidity_pct);
  const sound = safeFloat(d.sound_loudness);
  const note = (d.note ?? "").toString(); // KEEP "" (empty)
  const photoUrl = (d.photo_url ?? "").toString();
  const createdAt = d.created_at ?? "";

  const wc = wordCount(note);

  return {
    created_at: createdAt,
    event_id: eventId,
    temp_c: tempC,
    humidity_pct: humidity,
    sound_loudness: sound,
    note,
    note_word_count: wc,
    photo_url: photoUrl,
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

/*******************************************************
 * REFRESH + POLLING BURST
 * - API mode: poll every 3s for 15s
 * - Mock mode: just reload mock data immediately
 *******************************************************/
function startPollingBurst() {
  stopPollingBurst();

  if (!USE_API) {
    // Mock mode: no polling — just reload mock
    loadMock("Mock refresh");
    return;
  }

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
      )}s). Latest event_id: ${lastMaxEventId || "—"}`;
    }
  }, POLL_INTERVAL_MS);
}

function stopPollingBurst() {
  polling = false;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

/*******************************************************
 * LAYOUT HELPERS
 *******************************************************/
function computeLayout() {
  const usableW = width - margin * 2;
  const usableH = height - margin * 2 - 70;
  const targetCell = min(width, height) / 4.2;
  cellSize = constrain(targetCell, 90, 160);

  cols = max(1, floor(usableW / cellSize));
  rows = max(1, floor(usableH / cellSize));
}

function setupRefreshButton() {
  refreshBtn.w = 130;
  refreshBtn.h = 40;
  refreshBtn.x = width - margin - refreshBtn.w;
  refreshBtn.y = margin + 12;
}

/*******************************************************
 * DRAW: TOP BAR
 *******************************************************/
function drawTopBar() {
  noStroke();
  fill(20);
  rect(0, 0, width, 70);

  fill(255);
  textSize(14);
  textAlign(LEFT, CENTER);
  text("Environmental Snapshot Viewer", margin, 24);

  fill(200);
  textSize(12);
  text(statusMsg, margin, 48);

  drawRefreshButton();
}

function drawRefreshButton() {
  const { x, y, w, h } = refreshBtn;
  const hovering = isPointInRect(mouseX, mouseY, refreshBtn);

  stroke(255);
  strokeWeight(1);
  fill(hovering ? 60 : 40);
  rect(x, y, w, h, 10);

  noStroke();
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(13);

  // In mock mode, no need to say "Checking..."
  const label = USE_API ? (polling ? "Checking…" : "Refresh") : "Reload Mock";
  text(label, x + w / 2, y + h / 2);
}

/*******************************************************
 * DRAW: GRID
 *******************************************************/

/*******************************************************
 * DRAW: FLOW GRID (Option B)
 * - variable cell widths driven by humidity ring size
 * - portrait cells (fixed height)
 * - wraps rows when it hits the right edge
 * - draws ONE continuous baseline per row
 *******************************************************/
function drawGrid() {
  const topOffset = 70 + margin;

  if (!entries.length) {
    fill(180);
    textAlign(CENTER, CENTER);
    textSize(14);
    text("No entries yet (or all filtered).", width / 2, height / 2);
    return;
  }

  // ---- Flow layout tuning knobs ----
  const CELL_H = 150; // portrait height in pixels
  const BASELINE_PX = 105; // baseline position inside each cell (in px from cell top)
  const MIN_W = 78; // min cell width
  const MAX_W = 190; // max cell width
  const SIDE_PAD = 8; // padding so circle doesn't touch cell edges
  const ROW_GAP = 0; // no vertical gutters (you asked no padding between cells)

  // Display order:
  // - If you want latest first: show newest entry at the top-left
  // - If you want oldest first: show oldest entry at top-left
  // Toggle by switching which list we use.
  const showLatestFirst = true;

  // Work on a list of indices so we don't mutate entries
  let displayIndices = validEntryIndex.slice();

  // Latest first = reverse (assuming entries are sorted by event_id asc)
  // If your entries aren't sorted, you can sort here by event_id.
  if (showLatestFirst) displayIndices.reverse();

  // Start cursor
  let cursorX = margin;
  let cursorY = topOffset;

  // Track row baseline for continuous baseline drawing
  let rowStartX = cursorX;
  let rowBaselineY = cursorY + BASELINE_PX;
  let rowEndX = cursorX;

  // Helper: finish a row baseline
  function drawRowBaseline() {
    stroke(0);
    strokeWeight(2);
    strokeCap(SQUARE);
    line(rowStartX, rowBaselineY, rowEndX, rowBaselineY);
  }

  // Walk through entries in display order
  for (let k = 0; k < displayIndices.length; k++) {
    const entryIdx = displayIndices[k];
    const d = entries[entryIdx];

    // Map humidity to your ring diameter range (same as drawCell uses, in "100-space")
    const hum = constrain(d.humidity_pct, 0, 100);
    const humSize100 = map(hum, 0, 100, 10, 34); // diameter in 0..100 cell coords

    // Convert that 100-space size into pixels based on cell height scaling:
    // We scale y by CELL_H/100 in drawCell (sy). We'll use that to estimate diameter in px.
    const sy = CELL_H / 100;
    const ringDiameterPx = humSize100 * sy;

    // Variable width: ring diameter + padding + some extra breathing room
    let cellW = ringDiameterPx + SIDE_PAD * 2 + 40; // 40 gives room for stem + label
    cellW = constrain(cellW, MIN_W, MAX_W);

    // Wrap to next row if needed
    const rightLimit = width - margin;
    if (cursorX + cellW > rightLimit) {
      // draw baseline for the row we just finished
      rowEndX = cursorX;
      drawRowBaseline();

      // move to next row
      cursorX = margin;
      cursorY += CELL_H + ROW_GAP;

      rowStartX = cursorX;
      rowBaselineY = cursorY + BASELINE_PX;
    }

    // Draw the cell, passing rowBaselineY so baseline is shared
    drawCell(d, cursorX, cursorY, cellW, CELL_H, entryIdx, rowBaselineY);

    // advance cursor
    cursorX += cellW;

    // keep updating row end for baseline drawing
    rowEndX = cursorX;
  }

  // Draw baseline for the last row
  drawRowBaseline();
}

function drawCell(d, x, y, w, h, entryIndex, baselineYpx) {
  noStroke();
  fill(255);
  // rect(x, y, w - 6, h - 6, 12);
  rect(x, y, w, h); // full cell

  push();
  translate(x, y);

  // ✅ uniform scale so circles stay circles
  const s = min(w, h) / 100;

  // ✅ center the 100x100 “design space” in the rectangle
  const dx = (w - 100 * s) / 2;
  const dy = (h - 100 * s) / 2;
  translate(dx, dy);
  scale(s);

  // Convert row baseline from pixels -> local 0..100 coordinates
  // baselineYpx is in canvas pixels; our local origin is y + dy, and scale is s.
  const baselineLocalY = (baselineYpx - (y + dy)) / s;

  // stem = note word count
  const wc = constrain(d.note_word_count, 0, 60);
  const stemTopY = baselineLocalY - wc;

  stroke(0);
  strokeWeight(2);
  line(50, baselineLocalY, 50, stemTopY);

  // temp circle (color)
  colorMode(HSB, 360, 100, 100, 1);
  const hue = map(constrain(d.temp_c, -10, 35), -10, 35, 220, 20);
  noStroke();
  fill(hue, 80, 90, 1);
  circle(50, stemTopY, 14);
  colorMode(RGB, 255);

  // humidity ring (size)
  const hum = constrain(d.humidity_pct, 0, 100);
  const humSize = map(hum, 0, 100, 10, 34);
  noFill();
  stroke(0);
  strokeWeight(2);
  circle(50, stemTopY, humSize);

  // --- Mask rectangle under baseline (to block graphics) ---
  noStroke();
  fill(255);
  rect(0, baselineLocalY, 100, 25);

  // --- Event ID (bottom center) ---
  fill(0);
  textAlign(CENTER, CENTER);
  textSize(12);
  text(`${d.event_id}`, 50, baselineLocalY + 12);

  // --- Add-note reminder (positioned above humidity circle) ---
  if ((d.note ?? "").trim() === "") {
    const reminderOffset = 24; // distance above humidity circle
    const reminderY = stemTopY - reminderOffset;

    fill(0);
    textAlign(CENTER, CENTER);

    textSize(9);
    text("add note", 50, reminderY - 6);

    textSize(14);
    text("↓", 50, reminderY + 6);
  }

  pop();

  // store click bounds
  d.__cellBounds = { x, y, w, h, entryIndex };
}

/*******************************************************
 * MODAL
 *******************************************************/
function drawModal(d) {
  noStroke();
  fill(0, 200);
  rect(0, 0, width, height);

  const pad = 16;
  const cardW = width - pad * 2;
  const cardH = height - pad * 2;

  fill(255);
  rect(pad, pad, cardW, cardH, 16);

  // close button
  const closeSize = 34;
  const closeX = pad + cardW - closeSize - 10;
  const closeY = pad + 10;

  fill(0);
  rect(closeX, closeY, closeSize, closeSize, 10);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(16);
  text("✕", closeX + closeSize / 2, closeY + closeSize / 2);

  fill(0);
  textAlign(LEFT, TOP);

  let y = pad + 60;
  const x = pad + 18;

  textSize(18);
  text(`event_id: ${d.event_id}`, x, pad + 18);

  textSize(12);
  text(`created_at: ${d.created_at}`, x, pad + 42);

  y += 10;
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

  textSize(13);
  const noteText =
    (d.note ?? "").trim() === "" ? "(empty — submit via Google Form)" : d.note;

  const noteBoxW = cardW - 36;
  const noteBoxH = 160;

  noFill();
  stroke(0);
  rect(x, y, noteBoxW, noteBoxH, 10);

  noStroke();
  fill(0);
  text(noteText, x + 10, y + 10, noteBoxW - 20, noteBoxH - 20);
  y += noteBoxH + 18;

  textSize(14);
  text("photo_url:", x, y);
  y += 20;
  textSize(12);
  fill(0, 0, 200);
  text(d.photo_url || "(none)", x, y, noteBoxW, 60);

  d.__closeBounds = { x: closeX, y: closeY, w: closeSize, h: closeSize };
}

/*******************************************************
 * INPUT (mouse + touch)
 *******************************************************/
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
  // modal close
  if (selectedIndex >= 0) {
    const d = entries[selectedIndex];
    if (d.__closeBounds && isPointInRect(px, py, d.__closeBounds)) {
      selectedIndex = -1;
      return;
    }
    return;
  }

  // refresh button
  if (isPointInRect(px, py, refreshBtn)) {
    startPollingBurst();
    return;
  }

  // hit-test cells
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

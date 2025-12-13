/*******************************************************
 * P5.js — Environmental Snapshot Viewer (Mobile-first)
 *
 * What it does:
 * 1) Fetches JSON array from your Google Apps Script doGet()
 * 2) Filters out rows where note === "null" (string)
 * 3) Computes note word count for each entry
 * 4) Shows entries as a grid of “cells”
 * 5) Tap/click a cell to open a full-screen detail modal
 * 6) Manual Refresh button:
 *      - immediate fetch
 *      - then poll every 3s for 15s to detect new event_id
 *
 * IMPORTANT:
 * - Put your Apps Script Web App GET endpoint in GAS_GET_URL
 * - Your doGet() should return an array like:
 *   [
 *     { created_at, event_id, temp_c, humidity_pct, sound_loudness, note, photo_url },
 *     ...
 *   ]
 *******************************************************/

// 1) Set this to your Apps Script Web App URL (the one used for doGet)
const GAS_GET_URL =
  "https://script.google.com/macros/s/AKfycbyrm87nzk47xy1s7ojSL0HR44Ml9KwUk7RAqYcofmQzEBHp99Rd1hZva3KziSVrbR93/exec"; // e.g. https://script.google.com/macros/s/.../exec

// Polling behavior after user presses refresh
const POLL_INTERVAL_MS = 3000;
const POLL_TOTAL_MS = 15000;

// Layout
let cellSize; // pixel size of each cell
let cols, rows; // grid dimensions
let margin = 12;

// Data
let rawData = []; // full fetched array
let entries = []; // filtered + normalized + enriched
let lastMaxEventId = 0; // used to detect “new entry arrived”
let validEntryIndex = []; // indices of entries that are “valid” for display

// UI state
let selectedIndex = -1; // which entry is open in modal
let statusMsg = "Not loaded yet.";
let isFetching = false;

// Refresh + polling state
let polling = false;
let pollTimer = null;
let pollStartMs = 0;
let pollTicks = 0;

// Simple button bounds (we draw our own to stay mobile-friendly)
let refreshBtn = { x: 0, y: 0, w: 120, h: 40 };

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("system-ui");
  computeLayout();
  setupRefreshButton();

  // Initial load
  fetchAndUpdate("Initial load");
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  computeLayout();
  setupRefreshButton();
}

function draw() {
  background(0);

  // Header / status
  drawTopBar();

  // Grid
  drawGrid();

  // Detail modal on top
  if (selectedIndex >= 0) {
    drawModal(entries[selectedIndex]);
  }
}

/*******************************************************
 * Layout helpers
 *******************************************************/
function computeLayout() {
  // Choose a cell size that looks okay on mobile + desktop
  // You can tweak this for density.
  const usableW = width - margin * 2;
  const usableH = height - margin * 2 - 70; // leave room for top bar
  const targetCell = min(width, height) / 4.2; // “feel” control
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
 * Fetching + processing
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
    // Cache-bust to avoid stale responses
    const url = `${GAS_GET_URL}?t=${Date.now()}`;
    const resp = await fetch(url, { method: "GET" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    rawData = Array.isArray(data) ? data : [];

    // Normalize + filter:
    // - skip if note is literally the string "null"
    // - keep empty note "" because that’s how “new entries” appear
    entries = rawData.map(normalizeEntry).filter((d) => d.note !== "null");

    // Sort by event_id ascending (so the grid is stable)
    entries.sort((a, b) => (a.event_id || 0) - (b.event_id || 0));

    // validEntryIndex: entries that are displayable
    // (Right now: any entry that survived filtering.)
    validEntryIndex = entries.map((_, i) => i);

    // Detect newest event_id
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

function normalizeEntry(d) {
  // Convert to a consistent shape, with fallbacks
  const eventId = safeInt(d.event_id);
  const tempC = safeFloat(d.temp_c);
  const humidity = safeFloat(d.humidity_pct);
  const sound = safeFloat(d.sound_loudness);
  const note = (d.note ?? "").toString();
  const photoUrl = (d.photo_url ?? "").toString();
  const createdAt = d.created_at ?? "";

  // Word count for showcase:
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

// Counts words, treating empty/whitespace as 0
function wordCount(str) {
  const s = (str ?? "").trim();
  if (!s) return 0;
  return s.split(/\s+/).length;
}

/*******************************************************
 * Manual refresh + 15s polling burst
 *******************************************************/
function startPollingBurst() {
  // Stop existing poll if any
  stopPollingBurst();

  polling = true;
  pollStartMs = millis();
  pollTicks = 0;
  statusMsg = "Refreshing… (polling for new entry)";

  // Immediate fetch, then interval
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
 * Drawing: top bar + refresh button
 *******************************************************/
function drawTopBar() {
  // Background strip
  noStroke();
  fill(20);
  rect(0, 0, width, 70);

  // Title + status
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
  text(polling ? "Checking…" : "Refresh", x + w / 2, y + h / 2);
}

/*******************************************************
 * Drawing: grid of cells
 *******************************************************/
function drawGrid() {
  const topOffset = 70 + margin; // below top bar
  const usableW = width - margin * 2;
  const usableH = height - topOffset - margin;

  // If no data
  if (!entries.length) {
    fill(180);
    textAlign(CENTER, CENTER);
    textSize(14);
    text("No entries yet (or all filtered).", width / 2, height / 2);
    return;
  }

  // Grid origin
  const ox = margin;
  const oy = topOffset;

  // How many cells can we show on one screen?
  const perPage = cols * rows;

  // For now: show the most recent page (latest N)
  // This avoids endless scrolling on mobile.
  const startIdx = max(0, validEntryIndex.length - perPage);
  const pageIndices = validEntryIndex.slice(startIdx);

  for (let i = 0; i < pageIndices.length; i++) {
    const entryIdx = pageIndices[i];
    const d = entries[entryIdx];

    const c = i % cols;
    const r = floor(i / cols);

    const x = ox + c * cellSize;
    const y = oy + r * cellSize;

    drawCell(d, x, y, cellSize, cellSize, entryIdx);
  }
}

function drawCell(d, x, y, w, h, entryIndex) {
  // Cell background
  noStroke();
  fill(255);
  rect(x, y, w - 6, h - 6, 12);

  // Inner coordinate system (like your 100x100 mock)
  push();
  translate(x, y);
  const s = (w - 6) / 100;
  scale(s);

  // Baseline
  stroke(0);
  strokeWeight(2);
  line(10, 75, 90, 75);

  // “Stem height” = note word count (clamped)
  const wc = constrain(d.note_word_count, 0, 60);
  const stemTopY = 75 - wc;

  // Stem
  stroke(0);
  strokeWeight(2);
  line(50, 75, 50, stemTopY);

  // Temp color circle (HSB mapping)
  // Map temp_c roughly into hue range (adjust if you want)
  colorMode(HSB, 360, 100, 100, 1);
  const hue = map(constrain(d.temp_c, 10, 35), 10, 35, 200, 20); // cool->warm
  noStroke();
  fill(hue, 80, 90, 1);
  circle(50, stemTopY, 14);
  colorMode(RGB, 255);

  // Humidity ring size (outline only)
  const hum = constrain(d.humidity_pct, 0, 100);
  const humSize = map(hum, 0, 100, 10, 34);
  noFill();
  stroke(0);
  strokeWeight(2);
  circle(50, stemTopY, humSize);

  // Event id label
  noStroke();
  fill(0);
  textAlign(CENTER, CENTER);
  textSize(12);
  text(`${d.event_id}`, 50, 18);

  // If note is empty, show a subtle “needs note”
  if ((d.note ?? "").trim() === "") {
    fill(0);
    textSize(9);
    text("ADD NOTE", 50, 92);
  }

  pop();

  // Save the clickable region for this cell (simple hit-test)
  d.__cellBounds = { x, y, w: w - 6, h: h - 6, entryIndex };
}

/*******************************************************
 * Modal (full screen detail view)
 *******************************************************/
function drawModal(d) {
  // Dim background
  noStroke();
  fill(0, 200);
  rect(0, 0, width, height);

  // Modal card
  const pad = 16;
  const cardW = width - pad * 2;
  const cardH = height - pad * 2;

  fill(255);
  rect(pad, pad, cardW, cardH, 16);

  // Close button (X)
  const closeSize = 34;
  const closeX = pad + cardW - closeSize - 10;
  const closeY = pad + 10;
  fill(0);
  rect(closeX, closeY, closeSize, closeSize, 10);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(16);
  text("✕", closeX + closeSize / 2, closeY + closeSize / 2);

  // Text content
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

  // Note
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

  // Photo link (for now just show the URL; later you can load image)
  textSize(14);
  text("photo_url:", x, y);
  y += 20;
  textSize(12);
  fill(0, 0, 200);
  text(d.photo_url || "(none)", x, y, noteBoxW, 60);

  // Store modal close bounds for click/touch
  d.__closeBounds = { x: closeX, y: closeY, w: closeSize, h: closeSize };
}

/*******************************************************
 * Interaction (mouse + touch)
 *******************************************************/
function mousePressed() {
  handlePress(mouseX, mouseY);
}

function touchStarted() {
  // Use the first touch point
  if (touches && touches.length > 0) {
    handlePress(touches[0].x, touches[0].y);
    return false; // prevent page scroll on mobile
  }
}

function handlePress(px, py) {
  // If modal open, check close
  if (selectedIndex >= 0) {
    const d = entries[selectedIndex];
    if (d.__closeBounds && isPointInRect(px, py, d.__closeBounds)) {
      selectedIndex = -1;
      return;
    }
    // Otherwise: click anywhere outside close does nothing (keeps modal)
    return;
  }

  // Refresh button
  if (isPointInRect(px, py, refreshBtn)) {
    startPollingBurst();
    return;
  }

  // Hit-test cells
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

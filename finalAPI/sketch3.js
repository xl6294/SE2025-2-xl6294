/*
  ==========================================================
  Walkspace — Live Event Viewer (p5.js)
  ==========================================================
  Goals:
  - Fetch events from Google Apps Script doGet() (JSON array).
  - Filter ONLY note === "null" (string). Keep empty notes.
  - Slider browses "valid entry index" (0..validEvents-1).
  - Manual refresh button:
      * User presses Nano button to post an event
      * User presses "Check for new event (15s)" in p5
      * p5 polls every 3 seconds for 15 seconds
      * If a new entry arrives, auto-jumps to it and confirms success.
  - Show note word count as part of the display.

  You only need to:
  1) Paste your Apps Script /exec URL into API_URL
  2) Run this in your p5 project
*/

/// ======================= CONFIG ===========================
const API_URL =
  "https://script.google.com/macros/s/AKfycbyrm87nzk47xy1s7ojSL0HR44Ml9KwUk7RAqYcofmQzEBHp99Rd1hZva3KziSVrbR93/exec"; // must be /exec and doGet returns JSON array

// Background polling (lightweight "always-on" refresh)
// You can set this to 0 to disable background polling completely.
const BACKGROUND_POLL_MS = 600000; // 600s
// 8s is a safe default; burst mode handles fast checking

// Burst checking (manual “handshake mode”)
const BURST_POLL_MS = 3000; // poll every 3 seconds
const BURST_TOTAL_MS = 15000; // for 15 seconds

/// ======================= STATE ===========================
let events = []; // filtered events (note !== "null")
let selectedIndex = 0; // slider index into events
let slider;
let refreshBtn;

let statusMsg = "Loading…";
let lastFetchTimeMs = 0;

// For detecting “new event arrived”
let baselineCount = 0;

// Timers
let bgTimer = null;
let burstTimer = null;

// Burst mode state (for countdown UI)
let burstActive = false;
let burstEndsAtMs = 0;

/// ======================= P5 SETUP =========================
function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("system-ui");

  // Slider: valid entry index (0..events.length-1)
  slider = createSlider(0, 0, 0, 1);
  slider.input(() => {
    selectedIndex = slider.value();
  });

  // Manual "check" button
  refreshBtn = createButton("Check for new event (15s)");
  refreshBtn.mousePressed(startBurstCheck);

  // Initial fetch
  fetchAndUpdate({ jumpToLatest: true });

  // Optional background polling
  if (BACKGROUND_POLL_MS > 0) {
    bgTimer = setInterval(() => {
      // Background polls should NOT steal focus unless there’s truly a new event
      fetchAndUpdate({ jumpToLatestOnNew: true });
    }, BACKGROUND_POLL_MS);
  }

  layoutUI();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  layoutUI();
}

/// ======================= DRAW LOOP ========================
function draw() {
  background(245);

  layoutUI();
  drawHeader();

  if (!events || events.length === 0) {
    drawStatusCenter("No valid events yet (or API not reachable).");
    return;
  }

  // Clamp selection
  selectedIndex = constrain(selectedIndex, 0, events.length - 1);
  slider.value(selectedIndex);

  const e = events[selectedIndex];
  drawEvent(e);
  drawFooterHints(e);
}

/// ======================= UI LAYOUT ========================
function layoutUI() {
  const pad = 16;

  // Bottom area reserved for button + slider
  refreshBtn.position(pad, height - 92);

  slider.position(pad, height - 48);
  slider.size(min(540, width - pad * 2));
}

/// ======================= FETCH + UPDATE ===================
/*
  fetchAndUpdate options:
  - jumpToLatest: always jump to the newest event after fetching (good for first load)
  - jumpToLatestOnNew: jump only if a NEW event appeared (good for background polling)
*/
async function fetchAndUpdate({
  jumpToLatest = false,
  jumpToLatestOnNew = false,
} = {}) {
  try {
    statusMsg = burstActive ? "Checking… (burst polling)" : "Fetching…";

    // Avoid browser caching (important for "live" updates)
    const res = await fetch(API_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (!Array.isArray(data))
      throw new Error("API did not return a JSON array.");

    // Filter ONLY literal string "null" (do NOT filter empty notes)
    const filtered = data.filter((d) => d.note !== "null");

    // Sort so newest ends up last (optional but helps consistent behavior)
    filtered.sort((a, b) => {
      const ta = Date.parse(a.created_at) || 0;
      const tb = Date.parse(b.created_at) || 0;
      if (ta !== tb) return ta - tb;
      return (toNum(a.event_id) ?? 0) - (toNum(b.event_id) ?? 0);
    });

    // Preserve current selection by event_id if possible
    const currentId = events[selectedIndex]?.event_id;
    const prevLen = events.length;

    events = filtered;

    // Update slider bounds
    slider.attribute("max", max(0, events.length - 1));

    // Decide what to display
    const newLen = events.length;

    if (newLen === 0) {
      selectedIndex = 0;
    } else if (jumpToLatest) {
      selectedIndex = newLen - 1;
    } else if (jumpToLatestOnNew && newLen > prevLen) {
      selectedIndex = newLen - 1;
    } else if (currentId != null) {
      const idx = events.findIndex(
        (x) => String(x.event_id) === String(currentId)
      );
      if (idx !== -1) selectedIndex = idx;
      else selectedIndex = constrain(selectedIndex, 0, newLen - 1);
    } else {
      selectedIndex = constrain(selectedIndex, 0, newLen - 1);
    }

    lastFetchTimeMs = millis();
    statusMsg = `OK • ${events.length} valid events`;
  } catch (err) {
    statusMsg = `Fetch error: ${err.message}`;
  }
}

/// ======================= BURST CHECK (MANUAL) ==============
/*
  This supports your battery workflow:

  1) User presses Nano button to post an event.
  2) User presses "Check for new event (15s)" in p5.
  3) p5 polls quickly for 15s, and jumps to the newest event if it appears.
*/
async function startBurstCheck() {
  // Establish baseline: how many valid events do we have right now?
  await fetchAndUpdate({ jumpToLatest: false });
  baselineCount = events.length;

  burstActive = true;
  burstEndsAtMs = millis() + BURST_TOTAL_MS;
  statusMsg = "Checking… (polling every 3s for 15s)";

  // One immediate follow-up fetch (feels responsive)
  await fetchAndUpdate({ jumpToLatestOnNew: true });
  if (maybeResolveBurst()) return;

  // Start interval polling
  if (burstTimer) clearInterval(burstTimer);
  burstTimer = setInterval(async () => {
    await fetchAndUpdate({ jumpToLatestOnNew: true });

    // If new event arrived, end burst with success
    if (maybeResolveBurst()) return;

    // Stop after time runs out
    if (millis() >= burstEndsAtMs) {
      stopBurst("No new event detected in 15s.");
    }
  }, BURST_POLL_MS);
}

function maybeResolveBurst() {
  // "New event" means the valid list got longer
  if (events.length > baselineCount) {
    stopBurst("✅ New event detected!");
    // We already jump to latest in fetchAndUpdate when new length is detected
    return true;
  }
  return false;
}

function stopBurst(message) {
  burstActive = false;
  statusMsg = message;

  if (burstTimer) {
    clearInterval(burstTimer);
    burstTimer = null;
  }
}

/// ======================= NOTE WORD COUNT ===================
/*
  Word count definition:
  - Trims whitespace
  - Splits by one-or-more whitespace
  - If note is empty => 0
*/
function noteWordCount(note) {
  if (note == null) return 0;
  const s = String(note).trim();
  if (s === "") return 0;
  // split on any whitespace (spaces, newlines, tabs)
  return s.split(/\s+/).length;
}

/// ======================= DRAW HELPERS ======================
function drawHeader() {
  const pad = 16;

  fill(20);
  noStroke();
  textSize(16);
  textStyle(BOLD);
  text("Walkspace — Live Event Viewer", pad, 28);

  textStyle(NORMAL);
  textSize(12);
  text(statusMsg, pad, 46);

  // Burst countdown indicator (optional but helpful)
  if (burstActive) {
    const secsLeft = max(0, ceil((burstEndsAtMs - millis()) / 1000));
    fill(50);
    text(`Burst check: ${secsLeft}s left`, pad, 64);
  }
}

function drawStatusCenter(msg) {
  fill(40);
  textAlign(CENTER, CENTER);
  textSize(14);
  text(msg, width / 2, height / 2);
  textAlign(LEFT, BASELINE);
}

function drawEvent(e) {
  const pad = 16;
  const top = 76;
  const bottomUI = 110; // reserve space for button+slider

  // Parse numbers safely
  const tempC = toNum(e.temp_c);
  const hum = toNum(e.humidity_pct);
  const loud = toNum(e.sound_loudness);
  const eventId = e.event_id;

  // Circle encoding
  // humidity: 0–100 => radius 20–180
  const radius =
    hum == null ? 40 : map(constrain(hum, 0, 100), 0, 100, 20, 180);

  // temperature to color (cool->warm)
  colorMode(HSB, 360, 100, 100, 100);
  let c;
  if (tempC == null) {
    c = color(0, 0, 70, 95); // gray if missing
  } else {
    const hue = map(constrain(tempC, 0, 40), 0, 40, 200, 10); // blue->red
    c = color(hue, 70, 90, 90);
  }

  // Circle position (left side)
  const cx = width * 0.33;
  const cy = (top + (height - bottomUI)) / 2;

  noStroke();
  fill(c);
  circle(cx, cy, radius * 2);

  // Right-side text block
  colorMode(RGB, 255);
  const x0 = width * 0.55;
  const y0 = top + 10;
  const line = 18;

  fill(20);
  textSize(14);
  textStyle(BOLD);
  text(`Index ${selectedIndex} / ${events.length - 1}`, x0, y0);

  textStyle(NORMAL);
  textSize(12);

  text(`event_id: ${safe(eventId)}`, x0, y0 + line * 1);
  text(`created_at: ${formatTime(e.created_at)}`, x0, y0 + line * 2);

  text(`temp_c: ${tempC == null ? "—" : nf(tempC, 0, 1)}`, x0, y0 + line * 3);
  text(`humidity_pct: ${hum == null ? "—" : nf(hum, 0, 1)}`, x0, y0 + line * 4);
  text(`sound_loudness: ${loud == null ? "—" : loud}`, x0, y0 + line * 5);

  // Note area
  const note = (e.note ?? "").toString();
  const wc = noteWordCount(note);
  const needsNote = note.trim() === "";

  fill(needsNote ? color(200, 40, 40) : 20);
  textStyle(BOLD);
  text(
    needsNote ? `NOTE NEEDED (words: ${wc})` : `NOTE (words: ${wc})`,
    x0,
    y0 + line * 7
  );

  // Background box for legibility
  const noteBoxW = min(420, width - x0 - pad);
  const noteY = y0 + line * 8;

  noStroke();
  fill(255);
  rect(x0 - 8, noteY - 16, noteBoxW + 16, 140, 12);

  // Note text wrapped inside the box
  fill(20);
  textStyle(NORMAL);
  textWrap(WORD);
  const displayNote = needsNote
    ? `(empty — submit Google Form using event_id = ${safe(eventId)})`
    : note;

  text(displayNote, x0, noteY, noteBoxW);
}

function drawFooterHints(e) {
  const pad = 16;
  const y = height - 12;

  fill(40);
  textSize(12);
  textStyle(NORMAL);

  const id = e?.event_id;
  const note = (e?.note ?? "").toString().trim();

  let hint = `Slider = valid entry index. `;
  hint += `Press Nano → then click “Check for new event (15s)” here. `;
  if (note === "") {
    hint += `Submit Google Form with event_id = ${id} to attach note/photo URL.`;
  } else {
    hint += `To hide an entry, set note to "null" (string).`;
  }

  text(hint, pad, y);
}

/// ======================= SMALL UTILITIES ===================
function toNum(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function safe(v) {
  return v === null || v === undefined ? "—" : String(v);
}

function formatTime(t) {
  if (!t) return "—";
  const ms = Date.parse(t);
  if (!isFinite(ms)) return String(t);
  const d = new Date(ms);
  return d.toLocaleString();
}

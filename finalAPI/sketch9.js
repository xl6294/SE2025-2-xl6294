/*******************************************************
 * P5.js — Environmental Snapshot Viewer
 * MOBILE-ONLY VERSION (NO DESKTOP LOGIC)
 *******************************************************/

/* =========================
   MODE
========================= */
const USE_API = false;
const LIGHT_MODE = true;
const SHOW_LATEST_FIRST = true;

/* =========================
   MOCK DATA
========================= */
const mockData = [
  {
    event_id: 1,
    temp_c: 21,
    humidity_pct: 18,
    sound_loudness: 8,
    note: "Quiet indoor morning.",
  },
  { event_id: 2, temp_c: 20, humidity_pct: 25, sound_loudness: 14, note: "" },
  {
    event_id: 3,
    temp_c: 4,
    humidity_pct: 68,
    sound_loudness: 22,
    note: "Cold walk outside.",
  },
  {
    event_id: 4,
    temp_c: -6,
    humidity_pct: 55,
    sound_loudness: 19,
    note: "Crunchy snow.",
  },
  {
    event_id: 5,
    temp_c: 25,
    humidity_pct: 13,
    sound_loudness: 11,
    note: "Very dry air.",
  },
  {
    event_id: 6,
    temp_c: 17,
    humidity_pct: 42,
    sound_loudness: 47,
    note: "Cafe noise.",
  },
  { event_id: 7, temp_c: 1, humidity_pct: 79, sound_loudness: 28, note: "" },
  {
    event_id: 8,
    temp_c: 8,
    humidity_pct: 61,
    sound_loudness: 74,
    note: "Busy intersection.",
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
      panel: 245,
      ink: 0,
      text: 10,
      subtext: 80,
      btnFill: 255,
      btnStroke: 0,
    };
  }
  return {
    bg: 10,
    topBar: 20,
    panel: 10,
    ink: 235,
    text: 235,
    subtext: 170,
    btnFill: 40,
    btnStroke: 235,
  };
}

/* =========================
   MOBILE UI CONSTANTS
========================= */
const UI = {
  margin: 14,
  topBarH: 72,

  cellH: 160,
  baselinePx: 105,
  rowGap: 0,

  minW: 90,
  maxW: 220,
  sidePad: 10,

  tempDia: 16,
  humGapMin: 2,
  humGapMax: 16,

  textEventSize: 22,
  textNoteSize: 16,
  textArrowSize: 22,

  reminderOffsetLocal: 26,

  btnW: 110,
  btnH: 48,
  btnRadius: 14,
  btnTextSize: 18,
};

/* =========================
   STATE
========================= */
let entries = [];
let refreshBtn = { x: 0, y: 0, w: UI.btnW, h: UI.btnH };

/* =========================
   P5 SETUP
========================= */
function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("system-ui");
  entries = mockData.slice();
  setupRefreshButton();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  setupRefreshButton();
}

function setupRefreshButton() {
  refreshBtn.w = UI.btnW;
  refreshBtn.h = UI.btnH;
  refreshBtn.x = width - UI.margin - refreshBtn.w;
  refreshBtn.y = UI.margin + 12;
}

/* =========================
   DRAW
========================= */
function draw() {
  const T = theme();
  background(T.bg);

  drawTopBar();
  drawGrid();
}

/* =========================
   TOP BAR
========================= */
function drawTopBar() {
  const T = theme();

  noStroke();
  fill(T.topBar);
  rect(0, 0, width, UI.topBarH);

  fill(T.text);
  textSize(16);
  textAlign(LEFT, CENTER);
  text("Environmental Snapshot Viewer", UI.margin, 26);

  drawRefreshButton();
}

function drawRefreshButton() {
  const T = theme();

  stroke(T.btnStroke);
  fill(T.btnFill);
  rect(refreshBtn.x, refreshBtn.y, refreshBtn.w, refreshBtn.h, UI.btnRadius);

  noStroke();
  fill(T.text);
  textAlign(CENTER, CENTER);
  textSize(UI.btnTextSize);
  text(
    "Reload",
    refreshBtn.x + refreshBtn.w / 2,
    refreshBtn.y + refreshBtn.h / 2
  );
}

/* =========================
   GRID
========================= */
function drawGrid() {
  const T = theme();
  const topOffset = UI.topBarH + UI.margin;

  let list = SHOW_LATEST_FIRST ? entries.slice().reverse() : entries.slice();

  let x = UI.margin;
  let y = topOffset;
  let baselineY = y + UI.baselinePx;

  function drawBaseline() {
    stroke(T.ink);
    strokeWeight(2);
    line(UI.margin, baselineY, width - UI.margin, baselineY);
  }

  for (let d of list) {
    const humGap = map(d.humidity_pct, 0, 100, UI.humGapMin, UI.humGapMax);
    const humDia = UI.tempDia + humGap * 2;
    const ringPx = humDia * (UI.cellH / 100);

    let cellW = constrain(ringPx + UI.sidePad * 2 + 48, UI.minW, UI.maxW);

    if (x + cellW > width - UI.margin) {
      drawBaseline();
      x = UI.margin;
      y += UI.cellH + UI.rowGap;
      baselineY = y + UI.baselinePx;
    }

    drawCell(d, x, y, cellW, UI.cellH, baselineY);
    x += cellW;
  }

  drawBaseline();
}

/* =========================
   CELL
========================= */
function drawCell(d, x, y, w, h, baselineYpx) {
  const T = theme();

  fill(T.panel);
  noStroke();
  rect(x, y, w, h);

  const SCALE = min(w, h) / 100;
  const DX = (w - 100 * SCALE) / 2;
  const DY = (h - 100 * SCALE) / 2;

  const baselineLocalY = (baselineYpx - (y + DY)) / SCALE;
  const wc = constrain((d.note || "").split(" ").length, 0, 60);
  const stemTopY = baselineLocalY - wc;

  const humGap = map(d.humidity_pct, 0, 100, UI.humGapMin, UI.humGapMax);
  const humDia = UI.tempDia + humGap * 2;

  push();
  translate(x + DX, y + DY);
  scale(SCALE);

  stroke(T.ink);
  strokeWeight(2);
  line(50, baselineLocalY, 50, stemTopY);

  colorMode(HSB);
  fill(map(d.temp_c, -10, 35, 220, 20), 80, 90);
  noStroke();
  circle(50, stemTopY, UI.tempDia);
  colorMode(RGB);

  noFill();
  stroke(T.ink);
  circle(50, stemTopY, humDia);

  fill(T.panel);
  noStroke();
  rect(0, baselineLocalY, 100, 30);

  pop();

  fill(T.text);
  textAlign(CENTER, CENTER);
  textSize(UI.textEventSize);
  text(d.event_id, x + w / 2, baselineYpx + 30);

  if (!d.note) {
    textSize(UI.textNoteSize);
    text("add note", x + w / 2, y + 28);
    textSize(UI.textArrowSize);
    text("↓", x + w / 2, y + 48);
  }
}

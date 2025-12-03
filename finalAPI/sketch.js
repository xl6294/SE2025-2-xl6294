// URL of your Apps Script Web App (the /exec URL)
const API_URL =
  "https://script.google.com/macros/s/AKfycbxhQvTp3bnV71haLSJQey2SW-VePleWPdULr4hoizONcohxQrAp8YBcWE2_iswWrFN2/exec";

let events = [];
let loaded = false;

function setup() {
  createCanvas(800, 400);
  textFont("monospace");
  loadData();
  print(events);
}

async function loadData() {
  try {
    const res = await fetch(API_URL);
    events = await res.json();
    loaded = true;
    console.log("Loaded events:", events);
  } catch (err) {
    console.error("Error loading data:", err);
  }
}

function draw() {
  background(240);

  if (!loaded) {
    fill(0);
    textAlign(CENTER, CENTER);
    text("Loading data from API…", width / 2, height / 2);
    return;
  }

  // Simple visualization: one circle per event
  // x = index, y = mapped temp_f
  let margin = 40;
  let usableWidth = width - margin * 2;

  if (events.length === 0) {
    fill(0);
    textAlign(CENTER, CENTER);
    text("No events yet.", width / 2, height / 2);
    return;
  }

  // Find min/max temp for scaling
  let temps = events.map((e) => Number(e.temp_f));
  let tMin = Math.min(...temps);
  let tMax = Math.max(...temps);

  stroke(0);
  noFill();
  line(margin, height - margin, width - margin, height - margin); // x-axis

  noStroke();
  fill(50, 100, 200);

  for (let i = 0; i < events.length; i++) {
    let e = events[i];
    let x = map(i, 0, events.length - 1, margin, width - margin);
    let y = map(e.temp_f, tMin, tMax, height - margin, margin);

    ellipse(x, y, 10, 10);
  }

  // Draw last event’s info
  let last = events[events.length - 1];
  fill(0);
  textAlign(LEFT, TOP);
  text(
    `Last event_id: ${last.event_id}\n` +
      `Temp: ${last.temp_f} °F\n` +
      `Humidity: ${last.humidity_pct} %\n` +
      `Note: ${last.note}`,
    margin,
    margin
  );
}

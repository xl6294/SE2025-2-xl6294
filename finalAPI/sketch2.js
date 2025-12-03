// 👉 Replace with your Apps Script /exec URL
const API_URL =
  "https://script.google.com/macros/s/AKfycbxhQvTp3bnV71haLSJQey2SW-VePleWPdULr4hoizONcohxQrAp8YBcWE2_iswWrFN2/exec";

let events = [];
let loaded = false;
let slider;
let maxIndex = 25;

let tempMin, tempMax;
let humMin, humMax;

function setup() {
  createCanvas(800, 500);
  colorMode(HSB, 360, 100, 100);
  textFont("monospace");

  // Slider to select event index (ID-like selector)
  // 0–25 as requested
  slider = createSlider(0, maxIndex, 0, 1);
  slider.position(20, 20);
  slider.style("width", "300px");

  loadData();
}

async function loadData() {
  try {
    const res = await fetch(API_URL);
    events = await res.json();

    if (events.length === 0) {
      loaded = true;
      return;
    }

    // Compute min/max for temp_f and humidity_pct
    const temps = events.map((e) => Number(e.temp_f));
    const hums = events.map((e) => Number(e.humidity_pct));

    tempMin = Math.min(...temps);
    tempMax = Math.max(...temps);
    humMin = Math.min(...hums);
    humMax = Math.max(...hums);

    loaded = true;
    console.log("Loaded events:", events);
  } catch (err) {
    console.error("Error loading data:", err);
  }
}

function draw() {
  background(260, 10, 95); // soft background

  // UI label for slider
  fill(0);
  noStroke();
  textAlign(LEFT, TOP);
  textSize(14);
  text("Select event index (0–25):", 20, 0);

  if (!loaded) {
    textAlign(CENTER, CENTER);
    textSize(18);
    text("Loading data from API…", width / 2, height / 2);
    return;
  }

  if (events.length === 0) {
    textAlign(CENTER, CENTER);
    textSize(18);
    text("No events available.", width / 2, height / 2);
    return;
  }

  // Determine which index we're actually allowed to show
  let rawIndex = slider.value();
  let maxAvailableIndex = events.length - 1;
  let clampedIndex = constrain(
    rawIndex,
    0,
    Math.min(maxIndex, maxAvailableIndex)
  );

  // If there are fewer events than slider range, show a small message
  if (rawIndex > maxAvailableIndex) {
    fill(120, 80, 50);
    textAlign(LEFT, TOP);
    text(
      `Only ${events.length} events loaded.\n` +
        `Showing last available index: ${clampedIndex}`,
      20,
      50
    );
  }

  const e = events[clampedIndex];

  // Safety: parse numeric
  const tempF = Number(e.temp_f);
  const hum = Number(e.humidity_pct);

  // Map humidity to circle size
  // diameter ~ 60–300 px depending on humidity range
  const minDiameter = 60;
  const maxDiameter = 300;
  let diameter = map(hum, humMin, humMax, minDiameter, maxDiameter);
  diameter = constrain(diameter, minDiameter, maxDiameter);

  // Map temperature to color hue (blue → red)
  // lower temp: bluish (220), higher temp: warm (10)
  let hue = map(tempF, tempMin, tempMax, 220, 10);
  hue = constrain(hue, 10, 220);

  // Draw the circle in the center
  noStroke();
  fill(hue, 80, 90);
  ellipse(width / 2, height / 2, diameter, diameter);

  // Draw outline for clarity
  noFill();
  stroke(0, 0, 20);
  strokeWeight(2);
  ellipse(width / 2, height / 2, diameter, diameter);

  // Text info about current event
  noStroke();
  fill(0);
  textAlign(LEFT, TOP);
  textSize(14);

  const infoX = 20;
  const infoY = height - 160;

  let info = `
event index:   ${clampedIndex}
event_id:      ${e.event_id}
created_at:    ${e.created_at}
temp_f:        ${tempF.toFixed(1)} °F
humidity_pct:  ${hum.toFixed(1)} %
note:
${wrapText(e.note || "", 60)}
`;

  text(info, infoX, infoY);
}

// Simple manual wrap for multi-line note
function wrapText(str, maxChars) {
  if (!str) return "";
  let words = str.split(" ");
  let lines = [];
  let current = "";

  for (let w of words) {
    if ((current + w).length > maxChars) {
      lines.push(current.trim());
      current = w + " ";
    } else {
      current += w + " ";
    }
  }
  if (current.trim().length > 0) {
    lines.push(current.trim());
  }
  return lines.join("\n");
}

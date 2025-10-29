let s;
let robots = [];
let robotPresets = [];

// --- helper: normalize p5 loadJSON result into a real array
function toArray(maybeArrayOrObject) {
  if (!maybeArrayOrObject) return [];
  if (Array.isArray(maybeArrayOrObject)) return maybeArrayOrObject;
  if (Array.isArray(maybeArrayOrObject.presets))
    return maybeArrayOrObject.presets;
  if (Array.isArray(maybeArrayOrObject.robots))
    return maybeArrayOrObject.robots;
  // p5 sometimes returns {0:{},1:{},...}
  const vals = Object.values(maybeArrayOrObject);
  // if those values look like objects with your fields, accept them
  if (vals.length && typeof vals[0] === "object") return vals;
  return [];
}

function preload() {
  const base =
    "https://raw.githubusercontent.com/xl6294/SE2025-2-xl6294/main/robotAPI/robotAPI.json";
  const url = `${base}?nocache=${Date.now()}`; // bust caches

  loadJSON(
    url,
    // ✅ success
    (raw) => {
      console.log("✅ loadJSON success. Raw:", raw);
      // normalize to real array
      let arr = toArray(raw);
      if (!arr.length) arr = Object.values(raw || {}); // p5 sometimes gives {0:{},1:{},...}
      console.log("✅ normalized length:", arr.length);
      robotPresets = arr;

      if (!Array.isArray(robotPresets) || robotPresets.length === 0) {
        console.warn("⚠️ normalized result still empty. Using fallback.");
        robotPresets = [
          {
            id: "fallback-1",
            name: "nope",
            colorIndex: 2,
            type: "c",
            eyes: "dashes",
            mouth: "neutral",
            facing: "right",
            speed: 0.6,
          },
        ];
      }
    },
    // ❌ error
    (err) => {
      console.error("❌ loadJSON error:", err);
      console.warn("⚠️ Using fallback presets.");
      robotPresets = [
        {
          id: "fallback-1",
          name: "nope",
          colorIndex: 2,
          type: "c",
          eyes: "dashes",
          mouth: "neutral",
          facing: "right",
          speed: 0.6,
        },
      ];
    }
  );
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  s = min(width, height) / 100;
  // NOTE: scale once per frame in draw(); no need to scale here too.
  strokeWeight(1 / s);
  noFill();
  rectMode(CORNERS);
}

function draw() {
  background("#f2dbfeff");
  scale(s);

  for (let i = 0; i < robots.length; i++) {
    robots[i].move();
    robots[i].getMidY();
  }

  robots.sort((a, b) => a.midY - b.midY);

  for (let i = 0; i < robots.length; i++) robots[i].drawShadow();
  for (let i = 0; i < robots.length; i++) robots[i].display();
}

function mousePressed() {
  let amIHovering = false;

  for (let i = robots.length - 1; i >= 0; i--) {
    if (robots[i].hovering) {
      robots.splice(i, 1);
      amIHovering = true;
    }
  }

  if (!amIHovering) {
    // guard: ensure we have an array with items
    if (!Array.isArray(robotPresets) || robotPresets.length === 0) {
      console.warn("No presets available.");
      return;
    }

    const p = random(robotPresets);

    const colorPairs = [
      { tone: "#FFD400", accent: "#FF8C1A" },
      { tone: "#CCF20D", accent: "#0DA540" },
      { tone: "#47EBEB", accent: "#2060DF" },
      { tone: "#ff8fc7ff", accent: "#DF3020" },
    ];

    let r;
    if (p && Number.isFinite(+p.colorIndex)) {
      r = constrain(int(p.colorIndex), 0, colorPairs.length - 1);
    } else {
      r = floor(random(colorPairs.length));
    }

    const tempRobot = new Robot(
      mouseX,
      mouseY,
      p?.facing ?? random(["left", "right"]),
      colorPairs[r].tone,
      colorPairs[r].accent,
      p?.type ?? random(["a", "b", "c", "d"]),
      p?.eyes ?? random(["points", "dashes", "lashes"]),
      p?.mouth ?? random(["smile", "neutral"]),
      p?.name ?? ""
    );

    if (p && Number.isFinite(+p.speed)) tempRobot.speed = +p.speed;

    robots.push(tempRobot);
  }
}

// =========================================================
// Robot Class
// =========================================================
class Robot {
  constructor(x, y, facing, render, shade, type, eyes, mouth, name = "") {
    this.x = x;
    this.y = y;
    this.facing = facing;
    this.render = render;
    this.shade = shade;
    this.type = type;
    this.eyes = eyes;
    this.mouth = mouth;
    this.name = name;
    this.shadow = "#4F136C";
    this.speed = 0.5;
    this.midY = 0;
    this.hovering = false;
  }

  getMidY() {
    if (this.type === "a") {
      this.midY = this.y + 2.5 * s;
    } else if (this.type === "b") {
      this.midY = this.y - 0.25 * s;
    } else {
      this.midY = this.y;
    }
  }

  move() {
    if (this.facing === "right") {
      this.x = (this.x + this.speed) % width;
    } else if (this.facing === "left") {
      this.x = (this.x - this.speed + width) % width;
    }
  }

  drawShadow() {
    push();
    translate(this.x / s, this.y / s);
    scale(0.1);
    const yShift = this.type === "a" ? 75 : this.type === "b" ? 45 : 50;
    push();
    translate(0, yShift);
    noStroke();
    fill(this.shadow);
    ellipse(0, 0, 100, 30);
    pop();
    pop();
  }

  drawBody() {
    if (this.type == "a") {
      push();
      translate(0, 25);
      noStroke();
      fill(this.render);
      circle(0, 25, 50);
      fill(this.shade);
      circle(-25, 0, 50);
      circle(0, 0, 50);
      circle(25, 0, 50);
      fill(this.render);
      circle(0, -25, 50);
      pop();
    } else if (this.type == "b") {
      push();
      noStroke();
      fill(this.shade);
      circle(-25, 20, 50);
      circle(25, 20, 50);
      fill(this.render);
      circle(0, 0, 50);
      fill(this.shade);
      circle(-15, -25, 50);
      circle(15, -25, 50);
      pop();
    } else if (this.type == "c") {
      push();
      noStroke();
      fill(this.shade);
      circle(-25, 25, 50);
      circle(25, 25, 50);
      fill(this.render);
      circle(0, 0, 50);
      fill(this.shade);
      circle(-25, -25, 50);
      circle(25, -25, 50);
      circle(0, -15, 20);
      pop();
    } else if (this.type == "d") {
      push();
      noStroke();
      fill(this.shade);
      circle(-25, 0, 50);
      circle(25, 0, 50);
      fill(this.render);
      circle(25, -25, 50);
      circle(-25, 25, 50);
      fill(this.shade);
      circle(0, -25, 50);
      circle(0, 25, 50);
      circle(-25, -25, 50);
      circle(25, 25, 50);
      fill(this.render);
      circle(0, 0, 50);
      pop();
    }
  }

  drawExpression() {
    push();
    strokeJoin(ROUND);

    if (this.eyes === "points") {
      strokeWeight(5);
      point(-7, 0);
      point(7, 0);
    } else if (this.eyes === "dashes") {
      strokeWeight(3);
      line(-10, 0, -7, 0);
      line(7, 0, 10, 0);
    } else if (this.eyes === "lashes") {
      strokeWeight(5);
      point(-7, 0);
      point(7, 0);
      strokeWeight(3);
      line(-10, -3, -7, 0);
      line(4, -3, 7, 0);
    }

    if (this.mouth === "smile") {
      strokeWeight(3);
      noFill();
      arc(0, 0, 40, 40, PI / 3, (2 * PI) / 3, OPEN);
    } else if (this.mouth === "neutral") {
      strokeWeight(3);
      noFill();
      line(-10, 18, 10, 18);
    }

    beginShape();
    if (this.facing === "right") {
      vertex(0, 5);
      vertex(5, 10);
      vertex(0, 10);
    } else if (this.facing === "left") {
      vertex(0, 5);
      vertex(-5, 10);
      vertex(0, 10);
    }
    endShape();

    pop();
  }

  display() {
    if (dist(mouseX, mouseY, this.x, this.midY) < 7 * s) {
      this.hovering = true;
      this.shadow = "#8C28BD";
    } else {
      this.hovering = false;
      this.shadow = "#4F136C";
    }

    push();
    translate(this.x / s, this.y / s);
    scale(0.1);
    this.drawBody();

    if (this.name) {
      push();
      noStroke();
      fill(0);
      textAlign(CENTER, TOP);
      textSize(24);
      text(this.name, 0, -60);
      pop();
    }

    this.drawExpression();
    pop();

    if (keyIsPressed && key === "a") {
      push();
      stroke("white");
      strokeWeight(2);
      point(this.x / s, this.midY / s);
      pop();
    }
  }
}

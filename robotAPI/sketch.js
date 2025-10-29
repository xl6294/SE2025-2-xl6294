// Robot Generator using local robotAPI.json (same-folder)
// Click to add a robot at the mouse position.
// Click a robot to delete it.

let s;
let robots = [];
let robotPresets = [];

function preload() {
  // Because index.html, sketch.js, and robotAPI.json are in the SAME folder,
  // we can use a relative URL. This avoids CORS issues on GitHub Pages.
  // NOTE: If you open index.html directly from your file system (file://),
  // the browser will block fetches. Serve it (e.g., GitHub Pages) instead.
  const data = loadJSON(
    "https://raw.githubusercontent.com/xl6294/SE2025-2-xl6294/main/robotAPI/robotAPI.json"
  );

  // Ensure we always get an array
  if (Array.isArray(data)) {
    robotPresets = data;
  } else if (data && Array.isArray(data.presets)) {
    robotPresets = data.presets;
  } else if (data && Array.isArray(data.robots)) {
    robotPresets = data.robots;
  } else {
    robotPresets = [
      {
        id: "fallback-1",
        name: "Orbi",
        colorIndex: 2,
        type: "c",
        eyes: "dashes",
        mouth: "neutral",
        facing: "right",
        speed: 0.6,
      },
    ];
    console.warn(
      "⚠️ robotPresets was not an array. Check JSON structure or URL."
    );
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  s = min(width, height) / 100;
  scale(s);
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

  // Sort by midY to fake depth (smaller midY drawn first/back)
  robots.sort((a, b) => a.midY - b.midY);

  // Shadows first, then bodies/expressions
  for (let i = 0; i < robots.length; i++) robots[i].drawShadow();
  for (let i = 0; i < robots.length; i++) robots[i].display();
}

function mousePressed() {
  let amIHovering = false;

  // Delete hovered robots (iterate backwards when splicing)
  for (let i = robots.length - 1; i >= 0; i--) {
    if (robots[i].hovering === true) {
      robots.splice(i, 1);
      amIHovering = true;
    }
  }

  if (!amIHovering) {
    // Pick a preset from the API file
    const p = random(robotPresets);

    // Color pairs (tone = main, accent = shade)
    const colorPairs = [
      { tone: "#FFD400", accent: "#FF8C1A" },
      { tone: "#CCF20D", accent: "#0DA540" },
      { tone: "#47EBEB", accent: "#2060DF" },
      { tone: "#ff8fc7ff", accent: "#DF3020" },
    ];

    // Robust color index
    let r = 0;
    if (p && Number.isFinite(+p.colorIndex)) {
      r = constrain(int(p.colorIndex), 0, colorPairs.length - 1);
    } else {
      r = floor(random(colorPairs.length));
    }

    // Create the robot at mouse position
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

    this.facing = facing; // left/right (also sets nose direction)
    this.render = render; // main color
    this.shade = shade; // accent color
    this.type = type; // a, b, c, d
    this.eyes = eyes; // points, dashes, lashes
    this.mouth = mouth; // smile, neutral
    this.name = name; // optional label

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

    // eyes
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

    // mouth
    if (this.mouth === "smile") {
      strokeWeight(3);
      noFill();
      arc(0, 0, 40, 40, PI / 3, (2 * PI) / 3, OPEN);
    } else if (this.mouth === "neutral") {
      strokeWeight(3);
      noFill();
      line(-10, 18, 10, 18);
    }

    // nose (faces movement direction)
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
    // hover highlight
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

    // name label below the face/body cluster
    if (this.name) {
      push();
      noStroke();
      fill(0);
      textAlign(CENTER, TOP);
      textSize(10);
      text(this.name, 0, 60);
      pop();
    }

    this.drawExpression();
    pop();

    // debug: show anchor when pressing 'a'
    if (keyIsPressed && key === "a") {
      push();
      stroke("white");
      strokeWeight(2);
      point(this.x / s, this.midY / s);
      pop();
    }
  }
}

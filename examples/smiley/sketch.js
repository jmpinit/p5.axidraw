/**
 * This example uses the AxiDraw to draw a smiley face wherever the mouse is clicked.
 * Click the canvas to connect to the AxiDraw.
 */

const MAX_X_MM = 50;
const MAX_Y_MM = 50;

const SMILEY_RADIUS = 5;

const axi = new axidraw.AxiDraw();
let connected = false;
let drawing = false;

function setup() {
  createCanvas(400, 400);

  ellipseMode(CENTER);
  textAlign(CENTER);
}

function mmToPx(mmPos) {
  return createVector(
    constrain(map(mmPos.x, 0, MAX_X_MM, 0, width), 0, width),
    constrain(map(mmPos.y, 0, MAX_Y_MM, 0, height), 0, height),
  );
}


async function drawArc(x, y, radius, startAngle, endAngle, pointCount = 16) {
  const angleInc = (endAngle - startAngle) / pointCount;

  const x1 = radius * cos(startAngle);
  const y1 = radius * sin(startAngle);
  await axi.moveTo(x + x1, y + y1);
  await axi.penDown();

  for (let i = 0; i <= pointCount; i += 1) {
    const angle = startAngle + i * angleInc;

    const relX = radius * cos(angle);
    const relY = radius * sin(angle);

    await axi.moveTo(x + relX, y + relY);
  }

  await axi.penUp();
}

async function drawSmiley(x, y) {
  // Don't draw if we're already drawing,
  // because then the AxiDraw would be getting commands for different smileys interleaved
  if (drawing) {
    return;
  }

  drawing = true;

  // Draw the outline
  await drawArc(x, y, SMILEY_RADIUS, 0, TWO_PI);

  // Draw the eyes
  const eyeRadius = SMILEY_RADIUS / 6;
  await drawArc(x - SMILEY_RADIUS / 2, y - SMILEY_RADIUS / 3, eyeRadius, 0, TWO_PI);
  await drawArc(x + SMILEY_RADIUS / 2, y - SMILEY_RADIUS / 3, eyeRadius, 0, TWO_PI);

  // Draw the mouth
  const mouthRadius = SMILEY_RADIUS / 2;
  await drawArc(x, y + SMILEY_RADIUS / 6, mouthRadius, 0, PI);

  // Make it easier to recover from mistakes by turning off the motors
  await axi.disable();

  drawing = false;
}

function smileyPosition() {
  return createVector(
    constrain(map(mouseX, 0, width, 0, 50), SMILEY_RADIUS, MAX_X_MM - SMILEY_RADIUS),
    constrain(map(mouseY, 0, height, 0, 50), SMILEY_RADIUS, MAX_Y_MM - SMILEY_RADIUS),
  );
}

function mouseClicked() {
  if (!connected) {
    axi.connect().then(() => {
      connected = true;
    });

    return;
  }

  const { x, y } = smileyPosition();
  drawSmiley(x, y);
}

function draw() {
  if (!connected) {
    background(255, 0, 0);
    text('Click to Connect', width / 2, height / 2);
    return;
  }

  background(0, 255, 0);

  // Smiley at mouse position, but constrained to avoid going out of bounds
  const mmPos = smileyPosition();
  const pxPos = mmToPx(mmPos);
  const pxRadius = map(SMILEY_RADIUS, 0, MAX_X_MM, 0, width);

  noFill();
  stroke(0);
  ellipse(pxPos.x, pxPos.y, pxRadius * 2, pxRadius * 2);
}

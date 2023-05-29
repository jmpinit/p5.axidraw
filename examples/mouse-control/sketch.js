/**
 * This example shows how to control the AxiDraw using the mouse.
 * Click the canvas to connect to the AxiDraw. Then click and drag to draw.
 * The AxiDraw will follow the position of the mouse.
 */

const MAX_X_MM = 50;
const MAX_Y_MM = 50;
const MOVE_THRESHOLD_MM = 1;

const axi = new axidraw.AxiDraw();
let connected = false;
let moving = false;
let lastPos;

let lines = [];

function setup() {
  createCanvas(400, 400);

  textAlign(CENTER);
  ellipseMode(CENTER);

  fill(0);

  lastPos = createVector(0, 0);
}

function mouseClicked() {
  if (!connected) {
    axi.connect().then(() => {
      connected = true;
    });

    return;
  }
}

function mousePressed() {
  drawing = true;

  if (connected) {
    axi.penDown();
  }
}

function mouseReleased() {
  drawing = false;

  if (connected) {
    axi.penUp();
  }
}

function mmToPx(mmPos) {
  return createVector(
    constrain(map(mmPos.x, 0, MAX_X_MM, 0, width), 0, width),
    constrain(map(mmPos.y, 0, MAX_Y_MM, 0, height), 0, height),
  );
}

function moveAndDraw(x, y) {
  moving = true;
  axi.moveTo(x, y)
    .then(() => {
      moving = false;
    });

  if (!drawing) {
    return;
  }

  lines.push([
    mmToPx(lastPos),
    mmToPx(createVector(x, y)),
  ]);
}

function followMouse() {
  const x = constrain(map(mouseX, 0, width, 0, MAX_X_MM), 0, MAX_X_MM);
  const y = constrain(map(mouseY, 0, height, 0, MAX_Y_MM), 0, MAX_Y_MM);

  const pxPos = mmToPx(createVector(x, y));

  if (!drawing) {
    // Draw a cursor
    noStroke();
    ellipse(pxPos.x, pxPos.y, 5, 5);
  }

  // Only send motion commands when the mouse has moved more than the threshold
  // to reduce the number of commands sent to the AxiDraw
  if (!moving && dist(lastPos.x, lastPos.y, x, y) > MOVE_THRESHOLD_MM) {
    moveAndDraw(x, y);
    lastPos = createVector(x, y);
  }
}

function draw() {
  if (!connected) {
    background(255, 0, 0);
    text('Click to Connect', width / 2, height / 2);
    return;
  }

  background(0, 255, 0);

  if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
    // Move the pen to the mouse position if it is inside the canvas
    followMouse();
  }

  // Draw the lines
  stroke(0);
  strokeWeight(1);
  for (let i = 0; i < lines.length; i += 1) {
    line(lines[i][0].x, lines[i][0].y, lines[i][1].x, lines[i][1].y);
  }
}

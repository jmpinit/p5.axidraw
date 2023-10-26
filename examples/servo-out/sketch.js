/**
 * This example shows how to connect to the AxiDraw and move a servo connected to B2.
 * Click the canvas to connect to the AxiDraw. Then click again to activate the servo.
 * The servo position is controlled by the mouseY position.
 */

const axi = new axidraw.AxiDraw();
let connected = false;

function setup() {
  createCanvas(400, 400);
  background(0);
}

function draw() {
  if (!connected) {
    return;
  }

  background(255);
  stroke(255, 0, 0);
  line(0, mouseY, width, mouseY);
}

function mouseClicked() {
  if (!connected) {
    // Note: connect() must be called from a user gesture (e.g. a mouse click) due to
    // browser security restrictions
    axi.connect()
      .then(() => {
        connected = true;
      });

    return;
  }

  const dutyCycle = constrain(map(mouseY, 0, height, 0, 1), 0, 1);
  axi.servoOut(5, dutyCycle);
}

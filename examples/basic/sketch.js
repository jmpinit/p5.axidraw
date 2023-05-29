/**
 * This example shows how to connect to the AxiDraw and draw a line.
 * Click the canvas to connect to the AxiDraw. Then click again to draw the line.
 */

const axi = new axidraw.AxiDraw();
let connected = false;

function setup() {
  createCanvas(400, 400);
}

function mouseClicked() {
  if (!connected) {
    // Note: connect() must be called from a user gesture (e.g. a mouse click) due to
    // browser security restrictions
    axi.connect()
      .then(() => {
        connected = true;
      });
  }

  // Draw a diagonal line
  axi.penDown();
  axi.moveTo(10, 10);
  axi.penUp();

  // Draw a diagonal line, but async

  // axi.penDown()
  //   .then(() => axi.moveTo(10, 10))
  //   .then(() => axi.penUp());
}

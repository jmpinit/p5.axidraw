# p5.axidraw

A [p5.js](https://p5js.org/) library for controlling the [AxiDraw](https://axidraw.com/)
via the [WebSerial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API).

## Usage

```js
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
```

See the [examples](examples) directory for more.

## Documentation

See [jmpinit.github.io/p5.axidraw](https://jmpinit.github.io/p5.axidraw) for the API docs.

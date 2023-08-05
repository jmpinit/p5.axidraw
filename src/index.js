import {
  EiBotBoard,
  MOTOR_STEP_DIV16,
  MOTOR_DISABLE,
  SERVO_CHANNEL_PEN,
} from 'ebb-control';

/**
 * The number of motor steps per millimeter.
 * See {@link https://shop.evilmadscientist.com/productsmenu/846}.
 * @constant
 * @type {number}
 * @default
 */
export const STEPS_PER_MM = 80;

/**
 * The maximum speed of the AxiDraw in millimeters per second.
 * See {@link https://shop.evilmadscientist.com/productsmenu/846}.
 * @constant
 * @type {number}
 * @default
 */
export const MAX_MM_PER_SEC = 380;

/**
 * The minimum speed of the AxiDraw in millimeters per second.
 * See {@link https://evil-mad.github.io/EggBot/ebb.html#SM}.
 * @constant
 * @type {number}
 * @default
 */
export const MIN_MM_PER_SEC = 1.31 / STEPS_PER_MM;

function distance(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * A class for controlling the AxiDraw pen plotter.
 * @class
 */
// eslint-disable-next-line import/prefer-default-export
export class AxiDraw {
  constructor() {
    this.ebb = new EiBotBoard();
    this.connected = false;
    this.targetPos = { x: 0, y: 0 };
    this.lastCommandedPos = { x: 0, y: 0 };
    this.mmPerSec = 25;

    this.commands = [];
  }

  #command(cmdFn) {
    return new Promise((fulfill) => {
      const executeCommand = () => cmdFn()
        .then((result) => {
          fulfill(result);

          // Remove ourselves from the pending queue
          this.commands.shift();

          // Execute the next command if there is one
          if (this.commands.length > 0) {
            this.commands[0]().then();
          }
        });

      const pending = this.commands.length > 0;
      this.commands.push(executeCommand);

      if (!pending) {
        executeCommand().then();
      }
    });
  }

  /**
   * True if the AxiDraw is executing commands.
   * @returns {boolean}
   */
  isBusy() {
    return this.commands.length > 0;
  }

  /**
   * Connect to the AxiDraw via USB serial.
   * This will pop up a browser dialog asking the user to select the USB serial
   * connection for the AxiDraw.
   * @returns {Promise<void>} - Resolves when the connection is established.
   */
  async connect() {
    if (this.connected) {
      return;
    }

    await this.ebb.connect();
    this.connected = true;
  }

  /**
   * Disconnect from the AxiDraw.
   * @returns {Promise<void>} - Resolves when the connection is closed.
   */
  async disconnect() {
    if (!this.connected) {
      return;
    }

    await this.ebb.disconnect();
    this.connected = false;
  }

  /**
   * Enable the motors in the AxiDraw.
   * This will "lock" the position of the pen, so it can't be moved by hand.
   * Movement commands automatically enable the motors, so this is usually not needed.
   * The command is queued, so it will be executed after any previous commands.
   * @returns {Promise<void>} - Resolves when the motors are enabled.
   */
  async enable() {
    if (!this.connected) {
      return;
    }

    await this.#command(() => this.ebb.enableMotors(MOTOR_STEP_DIV16, MOTOR_STEP_DIV16));
  }

  /**
   * Disable the motors in the AxiDraw.
   * This will "unlock" the position of the pen, so it can be moved by hand.
   * The command is queued, so it will be executed after any previous commands.
   * @returns {Promise<void>} - Resolves when the motors are disabled.
   */
  async disable() {
    if (!this.connected) {
      return;
    }

    await this.#command(() => this.ebb.enableMotors(MOTOR_DISABLE, MOTOR_DISABLE));
  }

  /**
   * Get the current XY position of the pen in millimeters.
   * Asks the AxiDraw for the current position, and converts the motor steps to millimeters.
   * The command is queued, so it will be executed after any previous commands.
   * @returns {Promise<{x: number, y: number}>} - Resolves with the current position.
   */
  async currentPosition() {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    return this.#command(async () => {
      const [m1Steps, m2Steps] = await this.ebb.queryStepPosition();

      // See https://corexy.com/theory.html
      const x = 0.5 * ((m1Steps + m2Steps) / STEPS_PER_MM);
      const y = 0.5 * ((m1Steps - m2Steps) / STEPS_PER_MM);

      return { x, y };
    });
  }

  /**
   * Raise the pen.
   * The command is queued, so it will be executed after any previous commands.
   * @returns {Promise<void>} - Resolves when the pen is raised.
   */
  async penUp() {
    if (!this.connected) {
      return;
    }

    await this.#command(async () => {
      const penDown = await this.ebb.queryPen();

      // Wait for the command to be sent
      await this.ebb.setPenState(false);

      if (penDown) {
        // Wait for the pen to be raised
        await wait(1000); // TODO: optimize this
      }
    });
  }

  /**
   * Lower the pen.
   * The command is queued, so it will be executed after any previous commands.
   * @returns {Promise<void>} - Resolves when the pen is lowered.
   */
  async penDown() {
    if (!this.connected) {
      return;
    }

    await this.#command(async () => {
      const penDown = await this.ebb.queryPen();

      // Wait for the command to be sent
      await this.ebb.setPenState(true);

      if (!penDown) {
        // Wait for the pen to be lowered
        await wait(1000); // TODO: optimize this
      }
    });
  }

  /**
   * Directly control the pen lift servo position.
   * @param {number} normalizedHeight - The servo position in the range [0, 1].
   *   1 is up and 0 is down.
   * @returns {Promise<void>} - Resolves when the command is sent.
   */
  setPenHeight(normalizedHeight) {
    const height = Math.floor(Math.max(Math.min((1 - normalizedHeight) * 65535, 65535), 0));
    return this.#command(() => this.ebb.servoOutput(height, SERVO_CHANNEL_PEN, 32000));
  }

  /**
   * Set the speed of the pen.
   * @param {number} mmPerSec - The speed in millimeters per second.
   */
  setSpeed(mmPerSec) {
    // Clamp the values instead of throwing an error to be more user-friendly
    // at the risk of unintended behavior.
    this.mmPerSec = Math.max(Math.min(mmPerSec, MAX_MM_PER_SEC), MIN_MM_PER_SEC);
  }

  /**
   * Move the pen to a position specified by an XY coordinate in millimeters.
   * The command is queued, so it will be executed after any previous commands.
   * @param {number} x - The X coordinate in millimeters.
   * @param {number} y - The Y coordinate in millimeters.
   * @returns {Promise<void>} - Resolves when the pen has reached the destination.
   */
  async moveTo(x, y) {
    if (!this.connected) {
      return;
    }

    this.targetPos = { x, y };

    const distanceToTarget = distance(this.lastCommandedPos, this.targetPos);
    const timeToTarget = 1000 * (distanceToTarget / this.mmPerSec);

    if (timeToTarget < 1) {
      // We're already there
      return;
    }

    const delta = {
      x: this.targetPos.x - this.lastCommandedPos.x,
      y: this.targetPos.y - this.lastCommandedPos.y,
    };

    // https://corexy.com/theory.html
    const steps = {
      x: delta.x * STEPS_PER_MM,
      y: delta.y * STEPS_PER_MM,
    };

    this.lastCommandedPos = this.targetPos;

    await this.#command(async () => {
      // Wait for the command to be sent and acknowledged
      await this.ebb.stepperMoveMixedAxis(timeToTarget, steps.x, steps.y);

      // Wait for the motion to complete
      await wait(timeToTarget);
    });
  }

  stop() {
    if (!this.connected) {
      return Promise.resolve();
    }

    // Send the stop command immediately
    const stopPromise = this.ebb.emergencyStop(false);

    // Cancel all the outstanding commands in the queue
    this.commands = []; // FIXME: actually cancel the outstanding commands

    return stopPromise;
  }

  /**
   * Configure an analog input channel.
   * | Channel | Pin | Comments                                 |
   * | :------ | :-  | :--------------------------------------- |
   * | 0       | RA0 | Connected to current adjustment trim-pot |
   * | 1       | RA1 |                                          |
   * | 2       | RA2 |                                          |
   * | 3       | RA3 | (don't use) Pen lift servo power enable  |
   * | 4       | RA5 |                                          |
   * | 5       | RE0 | (don't use) Motor enable 1               |
   * | 6       | RE1 | (don't use) MS2                          |
   * | 7       | RE2 | (don't use) MS1                          |
   * | 8       | RB2 | Servo connector JP3                      |
   * | 9       | RB3 | Servo connector JP4                      |
   * | 10      | RB1 | Pen lift servo connector                 |
   * | 11      | RC2 |                                          |
   * | 12      | RB0 | Servo connector JP2                      |
   * @see analogRead
   * @param {number} channel - The analog channel number (0-12).
   * @param {boolean} enabled - Whether the channel should be enabled.
   * @returns {Promise<void>} - Resolves when the channel is configured.
   */
  async analogConfigure(channel, enabled) {
    if (!this.connected) {
      return;
    }

    // The EiBotBoard analog configure command allows for 16 channels, but only
    // the lower 13 correspond to physical pins.
    if (channel < 0 || channel > 12) {
      throw new Error('Invalid channel number');
    }

    await this.#command(async () => {
      await this.ebb.analogConfigure(channel, enabled);
    });
  }

  /**
   * Read an analog input channel. The value is normalized to a range of 0-1,
   *   where 1 represents 3.3V. The channel must be enabled with `analogConfigure`
   *   first. See `analogConfigure` for a list of channels and their pins.
   * @see analogConfigure
   * @param {number} channel - The analog channel number (0-12).
   * @returns {Promise<number>} - Resolves with the normalized value (0-1).
   */
  analogRead(channel) {
    if (!this.connected) {
      return Promise.resolve();
    }

    return this.#command(async () => {
      const analogValues = await this.ebb.analogValueGet(channel);

      if (!(channel in analogValues)) {
        throw new Error(`Channel not enabled. Enable it with analogConfigure(${channel}, true) first.`);
      }

      return analogValues[channel] / 1023; // Return normalized value
    });
  }

  /**
   * Read a byte from RAM at the specified address.
   * See {@link https://evil-mad.github.io/EggBot/ebb.html#MR}.
   * @param {number} address - Address to read (0 to 4095).
   * @returns {Promise<number>} - Resolves with the value at the given address (0-255).
   */
  memoryRead(address) {
    if (!this.connected) {
      return Promise.resolve();
    }

    return this.#command(() => this.ebb.memoryRead(address));
  }
}

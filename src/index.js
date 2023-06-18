import {
  EiBotBoard,
  MOTOR_STEP_DIV16,
  MOTOR_DISABLE,
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
}
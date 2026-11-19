// Neon Bay — keyboard + mouse input. Tracks held keys, pressed edges, and
// camera orbit dragging (mouse drag, or pointer lock after clicking the canvas).

export class Input {
  constructor(canvas) {
    this.keys = {};
    this.pressed = {}; // edge-triggered, cleared each frame by endFrame()
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.locked = false;
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      this.pressed[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });

    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      if (e.button === 0) {
        try { canvas.requestPointerLock(); } catch (err) { /* pointer lock optional */ }
      }
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    window.addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      } else if (this.mouseDown) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
  }

  held(code) { return !!this.keys[code]; }
  wasPressed(code) { return !!this.pressed[code]; }

  // WASD / arrows as a -1..1 pair, in camera space.
  moveAxes() {
    let x = 0, y = 0;
    if (this.held('KeyA') || this.held('ArrowLeft')) x -= 1;
    if (this.held('KeyD') || this.held('ArrowRight')) x += 1;
    if (this.held('KeyW') || this.held('ArrowUp')) y += 1;
    if (this.held('KeyS') || this.held('ArrowDown')) y -= 1;
    return { x, y };
  }

  consumeMouse() {
    const dx = this.mouseDX, dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return { dx, dy };
  }

  endFrame() { this.pressed = {}; }
}

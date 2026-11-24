/// <reference path="./novnc.d.ts" />
import type { CursorImage } from '@novnc/novnc';
import type { DesktopPointer } from './desktop-channel';

/** Where the framebuffer is drawn, in the viewer's own pixels, and its size in the server's. */
export interface DrawnScreen {
  left: number;
  top: number;
  width: number;
  height: number;
  framebufferWidth: number;
  framebufferHeight: number;
}

/**
 * Where the host's pointer lands over the drawn screen: its hot spot, in the
 * viewer's pixels from the same origin as `screen`, and how much one
 * framebuffer pixel measures there. The host speaks its own screen units (a
 * Retina Mac's points, half its framebuffer's pixels), so the pointer is
 * mapped by proportion, never taken as framebuffer pixels. `null` while there
 * is no screen to draw on, or the pointer is off it (on another display).
 */
export function placeHostPointer(
  pointer: DesktopPointer,
  screen: DrawnScreen,
): { x: number; y: number; scale: number } | null {
  if (screen.framebufferWidth <= 0 || screen.framebufferHeight <= 0 || screen.width <= 0) {
    return null;
  }
  const fx = pointer.x / pointer.width;
  const fy = pointer.y / pointer.height;
  if (!(fx >= 0 && fx < 1 && fy >= 0 && fy < 1)) return null;
  return {
    x: screen.left + fx * screen.width,
    y: screen.top + fy * screen.height,
    scale: screen.width / screen.framebufferWidth,
  };
}

/** Whether a cursor shape shows anything: a server hides its pointer with a clear one. */
function isVisibleCursor(image: CursorImage): boolean {
  if (image.w <= 0 || image.h <= 0) return false;
  for (let i = 3; i < image.rgbaPixels.length; i += 4) {
    if (image.rgbaPixels[i]) return true;
  }
  return false;
}

/**
 * The host's pointer drawn over a desktop while the reader watches: the
 * server's own cursor shape (Apple's Screen Sharing sends it but not where it
 * is) at the place the runner reports, scaled with the screen. Before the
 * server sends a shape, a plain arrow at the reader's own size. Hidden while
 * the reader is in control, since their own pointer is the host's then.
 *
 * It draws into `canvas`, which sits over `target` (noVNC's element) with the
 * same origin, and finds the framebuffer as the canvas noVNC put in `target`.
 */
export class HostPointerOverlay {
  private pointer: DesktopPointer | null = null;
  private shape: CursorImage | null = null;
  private watching = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly target: HTMLElement,
  ) {
    this.drawShape();
  }

  /** The server's cursor shape changed. */
  setShape(image: CursorImage): void {
    this.shape = isVisibleCursor(image) ? image : null;
    this.drawShape();
    this.place();
  }

  /** The host's pointer moved. */
  setPointer(pointer: DesktopPointer): void {
    this.pointer = pointer;
    this.place();
  }

  /** Whether the reader only watches, and the desktop is live. */
  setWatching(watching: boolean): void {
    this.watching = watching;
    this.place();
  }

  /** Put the pointer where it belongs now: after a move, a shape, or the screen resizing. */
  place(): void {
    const framebuffer = this.target.querySelector('canvas');
    const at =
      this.watching && this.pointer && framebuffer
        ? placeHostPointer(this.pointer, this.drawnScreen(framebuffer))
        : null;
    const style = this.canvas.style;
    if (!at) {
      style.display = 'none';
      return;
    }
    const shape = this.shape ?? ARROW;
    // The arrow is drawn at the reader's size; the server's shape at the screen's.
    const scale = this.shape ? at.scale : 1 / ARROW_DENSITY;
    style.display = 'block';
    style.width = `${shape.w * scale}px`;
    style.height = `${shape.h * scale}px`;
    style.transform = `translate(${at.x - shape.hotx * scale}px, ${at.y - shape.hoty * scale}px)`;
  }

  /** Hide the pointer for good. */
  dispose(): void {
    this.canvas.style.display = 'none';
  }

  private drawnScreen(framebuffer: HTMLCanvasElement): DrawnScreen {
    const screen = framebuffer.getBoundingClientRect();
    const origin = this.target.getBoundingClientRect();
    return {
      left: screen.left - origin.left,
      top: screen.top - origin.top,
      width: screen.width,
      height: screen.height,
      framebufferWidth: framebuffer.width,
      framebufferHeight: framebuffer.height,
    };
  }

  private drawShape(): void {
    const shape = this.shape ?? ARROW;
    this.canvas.width = shape.w;
    this.canvas.height = shape.h;
    const context = this.canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, shape.w, shape.h);
    context.putImageData(
      new ImageData(new Uint8ClampedArray(shape.rgbaPixels), shape.w, shape.h),
      0,
      0,
    );
  }
}

/** The arrow's pixels per reader pixel: drawn at twice its size, so it stays sharp on a dense screen. */
const ARROW_DENSITY = 2;

/** A plain black arrow with a white edge, 12 by 19 reader pixels, its hot spot at the tip. */
const ARROW: CursorImage = arrowImage();

function arrowImage(): CursorImage {
  const rows = [
    'X...........',
    'XX..........',
    'XoX.........',
    'XooX........',
    'XoooX.......',
    'XooooX......',
    'XoooooX.....',
    'XooooooX....',
    'XoooooooX...',
    'XooooooooX..',
    'XoooooooooX.',
    'XooooooXXXXX',
    'XoooXooX....',
    'XooXXooX....',
    'XoX..XooX...',
    'XX...XooX...',
    'X.....XooX..',
    '......XooX..',
    '.......XX...',
  ];
  const w = rows[0].length * ARROW_DENSITY;
  const h = rows.length * ARROW_DENSITY;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cell = rows[Math.floor(y / ARROW_DENSITY)][Math.floor(x / ARROW_DENSITY)];
      if (cell === '.') continue;
      const value = cell === 'X' ? 255 : 0;
      const i = (y * w + x) * 4;
      rgba[i] = value;
      rgba[i + 1] = value;
      rgba[i + 2] = value;
      rgba[i + 3] = 255;
    }
  }
  return { rgbaPixels: rgba, hotx: ARROW_DENSITY / 2, hoty: ARROW_DENSITY / 2, w, h };
}

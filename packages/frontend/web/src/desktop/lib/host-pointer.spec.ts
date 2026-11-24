import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HostPointerOverlay, placeHostPointer } from './host-pointer';

/**
 * The host's pointer lands where the host says it is on the screen as drawn:
 * a Retina Mac reports points, half its framebuffer's pixels, so taking them
 * as pixels would put the pointer at half its distance from the corner. It is
 * drawn only while the reader watches, never twice beside their own pointer.
 */

const RETINA = { width: 1920, height: 1080 };
// A 3840 by 2160 framebuffer scaled into 960 by 540, 20px from the top.
const DRAWN = {
  left: 0,
  top: 20,
  width: 960,
  height: 540,
  framebufferWidth: 3840,
  framebufferHeight: 2160,
};

describe('placeHostPointer', () => {
  it('maps a Retina host’s points onto its framebuffer as drawn, by proportion', () => {
    expect(placeHostPointer({ x: 960, y: 540, ...RETINA }, DRAWN)).toEqual({
      x: 480,
      y: 290,
      scale: 0.25,
    });
    expect(placeHostPointer({ x: 0, y: 0, ...RETINA }, DRAWN)).toEqual({
      x: 0,
      y: 20,
      scale: 0.25,
    });
  });

  it('draws no pointer that is off the screen, on another display', () => {
    expect(placeHostPointer({ x: 1920, y: 10, ...RETINA }, DRAWN)).toBeNull();
    expect(placeHostPointer({ x: -4, y: 10, ...RETINA }, DRAWN)).toBeNull();
    expect(placeHostPointer({ x: 10, y: 1080, ...RETINA }, DRAWN)).toBeNull();
  });

  it('draws nothing before the server has drawn a screen', () => {
    expect(
      placeHostPointer({ x: 10, y: 10, ...RETINA }, { ...DRAWN, framebufferWidth: 0 }),
    ).toBeNull();
  });
});

describe('HostPointerOverlay', () => {
  // jsdom has no ResizeObserver; the overlay only needs one to exist.
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  function overlay() {
    const target = document.createElement('div');
    const framebuffer = document.createElement('canvas');
    framebuffer.width = 3840;
    framebuffer.height = 2160;
    framebuffer.getBoundingClientRect = () => new DOMRect(0, 20, 960, 540);
    target.getBoundingClientRect = () => new DOMRect(0, 0, 960, 580);
    target.append(framebuffer);
    const canvas = document.createElement('canvas');
    return { pointer: new HostPointerOverlay(canvas, target), style: canvas.style };
  }

  it('shows the pointer while the reader watches, and hides it while they drive', () => {
    const { pointer, style } = overlay();
    pointer.setPointer({ x: 960, y: 540, ...RETINA });
    // Not live yet: the screen is not drawn.
    expect(style.display).toBe('none');

    pointer.setWatching(true);
    expect(style.display).toBe('block');

    pointer.setWatching(false);
    expect(style.display).toBe('none');
  });

  it('scales the server’s cursor shape with the screen, its hot spot on the pointer', () => {
    const { pointer, style } = overlay();
    pointer.setWatching(true);
    pointer.setPointer({ x: 960, y: 540, ...RETINA });
    pointer.setShape({
      rgbaPixels: new Uint8Array(28 * 40 * 4).fill(255),
      hotx: 4,
      hoty: 8,
      w: 28,
      h: 40,
    });
    expect(style.width).toBe('7px');
    expect(style.height).toBe('10px');
    expect(style.transform).toBe('translate(479px, 288px)');
  });

  it('falls back to its own arrow when the server hides its cursor with a clear shape', () => {
    const { pointer, style } = overlay();
    pointer.setWatching(true);
    pointer.setPointer({ x: 960, y: 540, ...RETINA });
    pointer.setShape({ rgbaPixels: new Uint8Array(4 * 4 * 4), hotx: 0, hoty: 0, w: 4, h: 4 });
    expect(style.width).toBe('12px');
    expect(style.height).toBe('19px');
  });
});

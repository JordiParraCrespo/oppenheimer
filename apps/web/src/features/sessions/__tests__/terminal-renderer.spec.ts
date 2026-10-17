import type { WebglAddon } from '@xterm/addon-webgl';
import type { Terminal } from '@xterm/xterm';
import { describe, expect, it, vi } from 'vitest';
import { bindTerminalRenderer, type RendererEnvironment } from '../lib/terminal-renderer';

/**
 * Wiping xterm's WebGL glyph atlas while output streams draws letters as
 * blocks (xterm.js #4480). The regressions guarded here are WebGL attaching
 * before the terminal's faces load, and a face that arrives later wiping
 * the atlas in place instead of rebuilding the renderer.
 */

function fakeTerminal() {
  const term = {
    rows: 24,
    loadAddon: vi.fn(),
    refresh: vi.fn(),
    clearTextureAtlas: vi.fn(),
  };
  return { term, asTerminal: term as unknown as Terminal };
}

function fakeAddon() {
  let lose: () => void = () => {};
  const addon = {
    dispose: vi.fn(),
    onContextLoss: vi.fn((listener: () => void) => {
      lose = listener;
    }),
    loseContext: () => lose(),
  };
  return addon;
}

function harness(options: { allowed?: boolean } = {}) {
  let fontsLoaded: () => void = () => {};
  const fonts = new EventTarget();
  const addons: ReturnType<typeof fakeAddon>[] = [];
  const env: RendererEnvironment = {
    webglAllowed: () => options.allowed ?? true,
    fontsReady: () =>
      new Promise<void>((resolve) => {
        fontsLoaded = resolve;
      }),
    createWebgl: () => {
      const addon = fakeAddon();
      addons.push(addon);
      return addon as unknown as WebglAddon;
    },
    fonts: fonts as unknown as FontFaceSet,
  };
  const { term, asTerminal } = fakeTerminal();
  const onCellsChanged = vi.fn();
  const unbind = bindTerminalRenderer(asTerminal, onCellsChanged, env);
  const faceLoaded = (family: string) => {
    const event = Object.assign(new Event('loadingdone'), { fontfaces: [{ family }] });
    fonts.dispatchEvent(event);
  };
  return {
    term,
    addons,
    onCellsChanged,
    unbind,
    faceLoaded,
    fontsReady: async () => {
      fontsLoaded();
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

describe('bindTerminalRenderer', () => {
  it('attaches WebGL only once the faces are ready', async () => {
    const h = harness();
    expect(h.term.loadAddon).not.toHaveBeenCalled();

    await h.fontsReady();

    expect(h.term.loadAddon).toHaveBeenCalledTimes(1);
    // What the typeahead draws by: told wrong, a guess sits off the echo.
    expect(h.onCellsChanged).toHaveBeenLastCalledWith('webgl');
  });

  it('never attaches WebGL where the policy refuses it', async () => {
    const h = harness({ allowed: false });
    await h.fontsReady();
    expect(h.term.loadAddon).not.toHaveBeenCalled();
  });

  it('rebuilds the renderer for a late face rather than wiping the atlas', async () => {
    const h = harness();
    await h.fontsReady();

    h.faceLoaded('"Oppenheimer Symbols"');

    expect(h.term.clearTextureAtlas).not.toHaveBeenCalled();
    expect(h.addons[0]?.dispose).toHaveBeenCalledTimes(1);
    expect(h.term.loadAddon).toHaveBeenCalledTimes(2);
  });

  it('ignores a face the terminal does not draw with', async () => {
    const h = harness();
    await h.fontsReady();
    h.onCellsChanged.mockClear();

    h.faceLoaded('Inter');

    expect(h.term.loadAddon).toHaveBeenCalledTimes(1);
    expect(h.onCellsChanged).not.toHaveBeenCalled();
  });

  it('stays on the DOM renderer after the GPU takes the context back', async () => {
    const h = harness();
    await h.fontsReady();

    h.addons[0]?.loseContext();
    expect(h.onCellsChanged).toHaveBeenLastCalledWith('dom');
    h.faceLoaded('"Oppenheimer Symbols"');

    expect(h.term.loadAddon).toHaveBeenCalledTimes(1);
    expect(h.term.clearTextureAtlas).not.toHaveBeenCalled();
  });

  it('attaches nothing once unbound before the faces are ready', async () => {
    const h = harness();
    h.unbind();
    await h.fontsReady();
    expect(h.term.loadAddon).not.toHaveBeenCalled();
  });
});

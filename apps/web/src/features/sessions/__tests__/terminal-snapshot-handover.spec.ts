import type { SessionStream } from '@oppenheimer/frontend-consumer';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { mountSessionTerminal } from '../lib/terminal-runtime';

/**
 * A pane opened on its kept picture hands over to the live screen only when
 * the far end draws. tmux's attach can open with a frame that paints nothing
 * (modes, a clear); resetting for that frame blanked the pane until the
 * redraw, with the waiting state already gone. The regression is a reset
 * before the first frame that draws, or the held frames lost or reordered,
 * which would drop the modes they set.
 */

const calls: string[] = [];
vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 80;
    rows = 24;
    options = {};
    unicode = { activeVersion: '' };
    buffer = { active: { type: 'normal' } };
    loadAddon() {}
    open() {}
    attachCustomKeyEventHandler() {}
    attachCustomWheelEventHandler() {}
    onData() {
      return { dispose() {} };
    }
    hasSelection() {
      return false;
    }
    write(data: string | Uint8Array, done?: () => void) {
      calls.push(`write ${typeof data === 'string' ? data : new TextDecoder().decode(data)}`);
      done?.();
    }
    reset() {
      calls.push('reset');
    }
    scrollToBottom() {}
    refresh() {}
    clearTextureAtlas() {}
    dispose() {}
  },
}));
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit() {}
  },
}));
vi.mock('@xterm/addon-unicode11', () => ({ Unicode11Addon: class {} }));
vi.mock('@xterm/addon-webgl', () => ({
  WebglAddon: class {
    onContextLoss() {}
  },
}));
vi.mock('@xterm/addon-serialize', () => ({
  SerializeAddon: class {
    serialize() {
      return 'SERIALIZED';
    }
  },
}));
vi.mock('../lib/terminal-echo', () => ({
  bindTerminalEcho: (_term: unknown, send: (data: string) => void) => ({
    send,
    received() {},
    repaint() {},
    dispose() {},
  }),
}));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

function streamWithData() {
  let deliver: (chunk: string, consumed: () => void) => void = () => {};
  const stream = {
    onData: (listener: typeof deliver) => {
      deliver = listener;
      return () => {};
    },
    onEnd: () => () => {},
    onStatus: () => () => {},
    send: () => {},
    resize: () => {},
    reconnectNow: () => {},
    dispose: () => {},
  } satisfies SessionStream;
  return { stream, deliver: (chunk: string, consumed: () => void) => deliver(chunk, consumed) };
}

describe('a pane opened on its kept picture', () => {
  it('keeps the picture through frames that paint nothing, then hands over in order', () => {
    calls.length = 0;
    const { stream, deliver } = streamWithData();
    const unmount = mountSessionTerminal(document.createElement('div'), stream, {
      snapshot: 'PICTURE',
    });
    expect(calls).toEqual(['write PICTURE']);

    const credited: string[] = [];
    deliver('\u001b[?1049h\u001b[H\u001b[2J', () => credited.push('preamble'));
    expect(calls).toEqual(['write PICTURE']);

    deliver('❯ ready', () => credited.push('redraw'));
    expect(calls.slice(1)).toEqual([
      'reset',
      expect.stringContaining('\u001b[?1049h'),
      expect.stringContaining('❯ ready'),
    ]);
    expect(credited).toEqual(['preamble', 'redraw']);
    unmount();
  });

  it('gives way to a link that never draws, rather than hold its credit', () => {
    calls.length = 0;
    const { stream, deliver } = streamWithData();
    const unmount = mountSessionTerminal(document.createElement('div'), stream, {
      snapshot: 'PICTURE',
    });
    let credited = 0;
    for (let frame = 0; frame < 16; frame += 1) deliver('\u001b[?25l', () => (credited += 1));
    expect(calls).toContain('reset');
    expect(credited).toBe(16);
    unmount();
  });
});

describe('a pane unmounting', () => {
  it('keeps a picture only once something was drawn', () => {
    const blank = streamWithData();
    const kept: string[] = [];
    mountSessionTerminal(document.createElement('div'), blank.stream, {
      keepSnapshot: (picture) => kept.push(picture),
    })();
    expect(kept).toEqual([]);

    const drawn = streamWithData();
    const unmount = mountSessionTerminal(document.createElement('div'), drawn.stream, {
      keepSnapshot: (picture) => kept.push(picture),
    });
    drawn.deliver('❯ ready', () => {});
    unmount();
    expect(kept).toEqual(['SERIALIZED']);
  });
});

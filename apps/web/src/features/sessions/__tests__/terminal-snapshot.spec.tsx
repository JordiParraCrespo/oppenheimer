import type { SessionStream } from '@oppenheimer/frontend-consumer';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTerminal } from '../hooks/use-terminal';
import type { SessionTerminalOptions } from '../lib/terminal-runtime';

/**
 * Switching back to a session paints the picture its pane showed last time,
 * not "Nothing on screen yet" while the link dials and tmux redraws. The
 * regression is a pane that unmounts without keeping its picture, or opens
 * without reading it: every switch is an empty grid again.
 */

const mounted: SessionTerminalOptions[] = [];
vi.mock('../lib/terminal-runtime', () => ({
  mountSessionTerminal: (
    _container: HTMLElement,
    _stream: SessionStream,
    options: SessionTerminalOptions = {},
  ) => {
    mounted.push(options);
    return () => options.keepSnapshot?.(`picture of ${mounted.length}`);
  },
}));
vi.mock('@oppenheimer/frontend-core/react', () => ({ useFeatureFlag: () => false }));
vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useHostPresence: () => ({ dataUpdatedAt: 0 }),
}));

const stream = {
  onData: () => () => {},
  onEnd: () => () => {},
  onStatus: () => () => {},
  send: () => {},
  resize: () => {},
  reconnectNow: () => {},
  dispose: () => {},
} satisfies SessionStream;
const createStream = () => stream;

function mount(snapshotKey: string) {
  return renderHook(() => {
    const terminal = useTerminal(createStream, { snapshotKey });
    terminal.containerRef.current ??= document.createElement('div');
    return terminal;
  });
}

describe('a session pane opened again', () => {
  it('opens on the picture it kept, with nothing to wait for', () => {
    const first = mount('s-1:0');
    expect(first.result.current.hasOutput).toBe(false);
    expect(mounted.at(-1)?.snapshot).toBeUndefined();
    first.unmount();

    const again = mount('s-1:0');
    expect(mounted.at(-1)?.snapshot).toBe('picture of 1');
    expect(again.result.current.hasOutput).toBe(true);
    again.unmount();
  });

  it("does not open on another session's picture", () => {
    const other = mount('s-2:0');
    expect(mounted.at(-1)?.snapshot).toBeUndefined();
    expect(other.result.current.hasOutput).toBe(false);
    other.unmount();
  });
});

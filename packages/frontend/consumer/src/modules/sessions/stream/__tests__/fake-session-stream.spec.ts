import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSessionStream } from '../fake-session-stream';

/**
 * The replay stands in for the runner until it exists, so what is asserted
 * here is the contract the real transport has to keep, not the transcript:
 * output reaches subscribers, keystrokes come back as echo rather than being
 * drawn locally, and closing the stream stops everything.
 */
describe('createFakeSessionStream', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('reports live once the connection settles', () => {
    const stream = createFakeSessionStream();
    const seen: string[] = [];
    stream.onStatus((status) => seen.push(status));

    expect(seen).toEqual(['connecting']);

    vi.advanceTimersByTime(100);
    expect(seen).toEqual(['connecting', 'live']);

    stream.dispose();
    expect(seen.at(-1)).toBe('closed');
  });

  it('replays output to every subscriber', () => {
    const stream = createFakeSessionStream();
    const chunks: string[] = [];
    stream.onData((chunk) => chunks.push(String(chunk)));

    vi.advanceTimersByTime(600);

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join('')).toContain('claude');

    stream.dispose();
  });

  it('echoes printable keystrokes back rather than drawing them locally', () => {
    const stream = createFakeSessionStream();
    const chunks: string[] = [];
    vi.advanceTimersByTime(6000);
    stream.onData((chunk) => chunks.push(String(chunk)));

    stream.send('l');
    stream.send('s');

    expect(chunks).toEqual(['l', 's']);

    stream.dispose();
  });

  it('answers Backspace with the erase sequence, and not past the line start', () => {
    const stream = createFakeSessionStream();
    const chunks: string[] = [];
    vi.advanceTimersByTime(6000);
    stream.onData((chunk) => chunks.push(String(chunk)));

    stream.send('');
    expect(chunks).toEqual([]);

    stream.send('a');
    stream.send('');
    expect(chunks).toEqual(['a', '\b \b']);

    stream.dispose();
  });

  it('leaves control characters to the host', () => {
    const stream = createFakeSessionStream();
    const chunks: string[] = [];
    vi.advanceTimersByTime(6000);
    stream.onData((chunk) => chunks.push(String(chunk)));

    // Ctrl-C. A real PTY decides what this does; the replay must not invent it.
    stream.send('');

    expect(chunks).toEqual([]);

    stream.dispose();
  });

  it('stops emitting once disposed', () => {
    const stream = createFakeSessionStream();
    const chunks: string[] = [];
    stream.onData((chunk) => chunks.push(String(chunk)));

    stream.dispose();
    vi.advanceTimersByTime(6000);
    stream.send('x');

    expect(chunks).toEqual([]);
  });
});

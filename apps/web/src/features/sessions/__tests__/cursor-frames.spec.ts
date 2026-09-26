import { describe, expect, it } from 'vitest';
import { CursorFrames, type CursorFrameTimers } from '../lib/cursor-frames';

const HIDE = '\x1b[?25l';
const SHOW = '\x1b[?12l\x1b[?25h';
const ON = '\x1b[?2026h';
const OFF = '\x1b[?2026l';

function manualTimers() {
  const pending = new Map<number, () => void>();
  let next = 0;
  const timers: CursorFrameTimers = {
    set: (callback) => {
      pending.set(++next, callback);
      return next;
    },
    clear: (handle) => {
      pending.delete(handle as number);
    },
  };
  const fire = () => {
    for (const [id, callback] of [...pending]) {
      pending.delete(id);
      callback();
    }
  };
  return { timers, fire, pending };
}

function frames() {
  const closed: string[] = [];
  const clock = manualTimers();
  const cursor = new CursorFrames((data) => closed.push(data), 100, clock.timers);
  return { cursor, closed, clock };
}

const bytes = (text: string) => new TextEncoder().encode(text);
const text = (data: Uint8Array) => new TextDecoder().decode(data);

describe('CursorFrames', () => {
  it('wraps a hide and its show in one synchronized frame', () => {
    const { cursor, clock } = frames();
    expect(cursor.frame(`${HIDE}draw${SHOW}`)).toBe(`${ON}${HIDE}draw${SHOW}${OFF}`);
    expect(clock.pending.size).toBe(0);
  });

  it('keeps the frame open across chunks until the show arrives', () => {
    const { cursor, closed, clock } = frames();
    expect(cursor.frame(`${HIDE}\x1b[10;1Hworking`)).toBe(`${ON}${HIDE}\x1b[10;1Hworking`);
    expect(cursor.frame('\x1b[12;3H')).toBe('\x1b[12;3H');
    expect(cursor.frame(SHOW)).toBe(`${SHOW}${OFF}`);
    expect(clock.pending.size).toBe(0);
    expect(closed).toEqual([]);
  });

  it('closes the frame itself when no show follows', () => {
    const { cursor, closed, clock } = frames();
    cursor.frame(`${HIDE}draw`);
    clock.fire();
    expect(closed).toEqual([OFF]);
    // The show that comes later is an ordinary show again.
    expect(cursor.frame(SHOW)).toBe(SHOW);
  });

  it('treats the blinking show (cvvis) as a show', () => {
    const { cursor } = frames();
    expect(cursor.frame(`${HIDE}x\x1b[?12;25h`)).toBe(`${ON}${HIDE}x\x1b[?12;25h${OFF}`);
  });

  it('leaves a show with no open frame, and other modes, alone', () => {
    const { cursor } = frames();
    const chunk = `${SHOW}\x1b[?1049h\x1b[?2004l plain`;
    expect(cursor.frame(chunk)).toBe(chunk);
  });

  it('opens one frame for repeated hides', () => {
    const { cursor } = frames();
    expect(cursor.frame(`${HIDE}a${HIDE}b${SHOW}`)).toBe(`${ON}${HIDE}a${HIDE}b${SHOW}${OFF}`);
  });

  it('rewrites bytes the same way, keeping UTF-8 intact', () => {
    const { cursor } = frames();
    const out = cursor.frame(bytes(`${HIDE}• Working ─ ✓${SHOW}`));
    expect(out).toBeInstanceOf(Uint8Array);
    expect(text(out)).toBe(`${ON}${HIDE}• Working ─ ✓${SHOW}${OFF}`);
  });

  it('hands back the same chunk when there is nothing to rewrite', () => {
    const { cursor } = frames();
    const chunk = bytes('plain \x1b[1mbold\x1b[0m');
    expect(cursor.frame(chunk)).toBe(chunk);
  });

  it('stops its timer on dispose', () => {
    const { cursor, closed, clock } = frames();
    cursor.frame(HIDE);
    cursor.dispose();
    expect(clock.pending.size).toBe(0);
    expect(closed).toEqual([]);
  });
});

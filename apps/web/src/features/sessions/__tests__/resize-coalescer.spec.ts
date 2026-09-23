import { describe, expect, it } from 'vitest';
import { createResizeCoalescer } from '../lib/resize-coalescer';

/** A clock the test advances by hand. */
function manualClock() {
  let now = 0;
  let timers: { at: number; fn: () => void }[] = [];
  return {
    schedule(fn: () => void, ms: number) {
      const timer = { at: now + ms, fn };
      timers.push(timer);
      return () => {
        timers = timers.filter((t) => t !== timer);
      };
    },
    advance(ms: number) {
      now += ms;
      const due = timers.filter((t) => t.at <= now);
      timers = timers.filter((t) => t.at > now);
      for (const t of due) t.fn();
    },
  };
}

describe('createResizeCoalescer', () => {
  it('sends the first size at once, so the attach carries the viewport', () => {
    const sent: string[] = [];
    const clock = manualClock();
    const pty = createResizeCoalescer((c, r) => sent.push(`${c}x${r}`), {
      schedule: clock.schedule,
    });
    pty.request(120, 40);
    expect(sent).toEqual(['120x40']);
  });

  it('sends only the size a drag settles on', () => {
    const sent: string[] = [];
    const clock = manualClock();
    const pty = createResizeCoalescer((c, r) => sent.push(`${c}x${r}`), {
      schedule: clock.schedule,
    });
    pty.request(120, 40);
    for (let cols = 121; cols <= 140; cols += 1) {
      pty.request(cols, 40);
      clock.advance(16);
    }
    expect(sent).toEqual(['120x40']);
    clock.advance(100);
    expect(sent).toEqual(['120x40', '140x40']);
  });

  it('does not repeat a size already sent', () => {
    const sent: string[] = [];
    const clock = manualClock();
    const pty = createResizeCoalescer((c, r) => sent.push(`${c}x${r}`), {
      schedule: clock.schedule,
    });
    pty.request(120, 40);
    pty.request(130, 40);
    pty.request(120, 40);
    clock.advance(100);
    expect(sent).toEqual(['120x40']);
  });

  it('ignores an empty grid and sends nothing after dispose', () => {
    const sent: string[] = [];
    const clock = manualClock();
    const pty = createResizeCoalescer((c, r) => sent.push(`${c}x${r}`), {
      schedule: clock.schedule,
    });
    pty.request(0, 0);
    expect(sent).toEqual([]);
    pty.request(80, 24);
    pty.request(100, 30);
    pty.dispose();
    clock.advance(1_000);
    expect(sent).toEqual(['80x24']);
  });
});

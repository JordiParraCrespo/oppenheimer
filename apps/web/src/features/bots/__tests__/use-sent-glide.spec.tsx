import { act, cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatScroll, useSentGlide } from '../hooks/use-sent-glide';

/**
 * A message you send glides to the top of the chat and the chat lands on it.
 * The regressions this guards: opening a chat gliding the newest message you
 * had already sent (it opens where it is), and the glide pulling back down a
 * reader who took hold of the scroll mid-way.
 */

let held = false;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function Transcript({ sent }: { sent: string[] }) {
  useSentGlide(sent.at(-1));
  return sent.map((id) => <div key={id} data-message-id={id} />);
}

function Harness({ sent }: { sent: string[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const room = useRef<HTMLDivElement>(null);
  return (
    <ChatScroll
      value={{
        scroller,
        room,
        hold: (owning) => {
          held = owning;
        },
      }}
    >
      <div ref={scroller} data-testid="scroller">
        <div>
          <Transcript sent={sent} />
        </div>
        <div ref={room} />
      </div>
    </ChatScroll>
  );
}

/** A scroller 1000px tall inside a 300px window, read where the reader left it. */
function measure(box: HTMLElement) {
  let top = 0;
  Object.defineProperty(box, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (value: number) => {
      top = value;
    },
  });
  Object.defineProperty(box, 'scrollHeight', { configurable: true, get: () => 1000 });
  Object.defineProperty(box, 'clientHeight', { configurable: true, get: () => 300 });
}

describe('useSentGlide', () => {
  it('opens on the messages already sent and glides the next one you send', () => {
    const view = render(<Harness sent={['m1']} />);
    const box = view.getByTestId('scroller');
    measure(box);
    box.scrollTop = 200;
    act(() => vi.advanceTimersByTime(400));
    expect(box.scrollTop).toBe(200);
    expect(held).toBe(false);

    view.rerender(<Harness sent={['m1', 'm2']} />);
    expect(held).toBe(true);
    act(() => vi.advanceTimersByTime(400));
    expect(box.scrollTop).toBe(1000);
    expect(held).toBe(false);
  });

  it('lets go where the reader took hold of the scroll mid-glide', () => {
    const view = render(<Harness sent={['m1']} />);
    const box = view.getByTestId('scroller');
    measure(box);

    view.rerender(<Harness sent={['m1', 'm2']} />);
    act(() => vi.advanceTimersByTime(50));
    box.scrollTop = 100;
    act(() => vi.advanceTimersByTime(400));
    expect(box.scrollTop).toBe(100);
    expect(held).toBe(false);
  });
});

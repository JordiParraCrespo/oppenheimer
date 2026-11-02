import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useStickToBottom } from '../hooks/use-stick-to-bottom';

/**
 * The chat follows the answer to what you just sent, even when you had
 * scrolled up to read. The regression this guards: once the conversation
 * fills the API's window, sending evicts the oldest message, so the number
 * of your messages on screen stays the same and a count saw no send.
 */

let grow: (() => void) | undefined;

beforeEach(() => {
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) {
      grow = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  grow = undefined;
});

function Harness({ sent }: { sent: string[] }) {
  const { scroller, content } = useStickToBottom();
  return (
    <div ref={scroller} data-testid="scroller">
      <div ref={content}>
        {sent.map((id) => (
          <div key={id} data-slot="chat-user-message" data-message-id={id} />
        ))}
      </div>
    </div>
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

/** The reader scrolls up: a wheel turned up, then the pane moves. */
function scrollUp(box: HTMLElement) {
  box.scrollTop = 700;
  box.dispatchEvent(new Event('scroll'));
  box.dispatchEvent(new WheelEvent('wheel', { deltaY: -600 }));
  box.scrollTop = 100;
  box.dispatchEvent(new Event('scroll'));
}

describe('useStickToBottom', () => {
  it('pins to the message you sent when the window is full and the count stays the same', () => {
    const view = render(<Harness sent={['m1', 'm2', 'm3']} />);
    const box = view.getByTestId('scroller');
    measure(box);
    scrollUp(box);

    // A reply streaming in while you read does not move you.
    act(() => grow?.());
    expect(box.scrollTop).toBe(100);

    // You send: the oldest falls out of the window, the newest is yours.
    view.rerender(<Harness sent={['m2', 'm3', 'm4']} />);
    act(() => grow?.());
    expect(box.scrollTop).toBe(1000);
  });

  it('turns scroll anchoring off while it follows the end, and back on while you read', () => {
    // What breaks this: anchoring left on while following, so messages that
    // leave the top of a full window move the view up, which reads as the
    // reader leaving the end, and the chat stops following; or anchoring
    // left off while reading, so the same messages move the reader's place.
    const view = render(<Harness sent={['m1', 'm2', 'm3']} />);
    const box = view.getByTestId('scroller');
    measure(box);
    act(() => grow?.());
    expect(box.style.overflowAnchor).toBe('none');

    scrollUp(box);
    expect(box.style.overflowAnchor).toBe('');

    view.rerender(<Harness sent={['m2', 'm3', 'm4']} />);
    act(() => grow?.());
    expect(box.style.overflowAnchor).toBe('none');
  });

  it('keeps following when the browser moves the view up with no input from the reader', () => {
    // What breaks this: any move up read as the reader leaving. Content that
    // shrinks makes the browser clamp the view up, reported a frame later,
    // once the content may have grown again, and the chat stopped following
    // a long conversation as it loaded, short of its end.
    const view = render(<Harness sent={['m1', 'm2', 'm3']} />);
    const box = view.getByTestId('scroller');
    measure(box);
    act(() => grow?.());
    // The browser reports the hook's own scroll to the end.
    box.dispatchEvent(new Event('scroll'));
    expect(box.scrollTop).toBe(1000);

    box.scrollTop = 400;
    act(() => {
      box.dispatchEvent(new Event('scroll'));
    });
    expect(box.scrollTop).toBe(1000);
    act(() => grow?.());
    expect(box.scrollTop).toBe(1000);
    expect(box.style.overflowAnchor).toBe('none');
  });
});

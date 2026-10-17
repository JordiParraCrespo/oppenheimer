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

function scrollUp(box: HTMLElement) {
  box.scrollTop = 700;
  box.dispatchEvent(new Event('scroll'));
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
});

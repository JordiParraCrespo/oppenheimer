import type { DeviceInput } from '@oppenheimer/frontend-consumer';
import { type KeyboardEvent, type PointerEvent, useState } from 'react';

/** A press that moves less than this (a fraction of the screen) is a tap. */
const TAP_SLOP = 0.02;

const KEYS: Record<string, 'enter' | 'backspace' | 'escape' | 'tab'> = {
  Enter: 'enter',
  Backspace: 'backspace',
  Escape: 'escape',
  Tab: 'tab',
};

/**
 * A session's device in a phone's frame (`SessionsConsole.dc.html`, the
 * preview pane's Simulator): the bezel, the screen's live frame, and the
 * reader's hand on it. A click taps, a drag swipes, and typing with the
 * screen focused types into the device. Points go out as fractions of the
 * screen, so nothing here knows the device's resolution.
 */
export function DeviceFrame({
  label,
  frameUrl,
  onDrawn,
  onInput,
  onType,
}: {
  /** What a screen reader hears: "App running on Android emulator". */
  label: string;
  frameUrl: string | null;
  /** The frame on screen has been drawn: the credit for the next one. */
  onDrawn: () => void;
  onInput: (input: DeviceInput) => void;
  onType: (text: string) => void;
}) {
  const [pressed, setPressed] = useState<{ x: number; y: number } | null>(null);

  // Where the pointer is on the device's screen, which is the image as drawn:
  // contained in the frame, so letterboxed when the device's shape is not
  // the frame's.
  const point = (event: PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const image = event.currentTarget.querySelector('img');
    let { left, top, width, height } = box;
    if (image?.naturalWidth && image.naturalHeight) {
      const scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
      width = image.naturalWidth * scale;
      height = image.naturalHeight * scale;
      left += (box.width - width) / 2;
      top += (box.height - height) / 2;
    }
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    return {
      x: clamp((event.clientX - left) / width),
      y: clamp((event.clientY - top) / height),
    };
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    setPressed(point(event));
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (!pressed) return;
    const to = point(event);
    setPressed(null);
    const moved = Math.hypot(to.x - pressed.x, to.y - pressed.y) > TAP_SLOP;
    onInput(
      moved
        ? { kind: 'swipe', x: pressed.x, y: pressed.y, toX: to.x, toY: to.y }
        : { kind: 'tap', x: to.x, y: to.y },
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = KEYS[event.key];
    if (key) {
      event.preventDefault();
      onInput({ kind: 'key', key });
    } else if (event.key.length === 1) {
      event.preventDefault();
      onType(event.key);
    }
  };

  return (
    // A size container: the phone takes the width the pane's height allows, or
    // the reverse, so it keeps its shape whatever the pane's size.
    <div className="flex size-full items-center justify-center [container-type:size]">
      <div className="flex aspect-[410/864] w-[min(calc(100cqw-40px),calc((100cqh-40px)*410/864))] flex-col rounded-[58px] bg-device-bezel p-2.5 ring-1 ring-border">
        <section
          aria-label={label}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: the screen takes the reader's keys and pointer like a canvas does
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setPressed(null)}
          onKeyDown={onKeyDown}
          className="relative min-h-0 flex-1 cursor-pointer touch-none select-none overflow-hidden rounded-[48px] bg-device-bezel outline-none focus-visible:outline-2 focus-visible:outline-primary"
        >
          {frameUrl ? (
            <img
              src={frameUrl}
              alt=""
              draggable={false}
              onLoad={onDrawn}
              className="pointer-events-none size-full object-contain"
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}

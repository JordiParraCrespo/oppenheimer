import type { DeviceInput } from '@oppenheimer/frontend-consumer';
import { type KeyboardEvent, type PointerEvent, type ReactNode, useRef } from 'react';
import { gestureOf, type PointerSample } from '../lib/device-gesture';

const KEYS: Record<string, 'enter' | 'backspace' | 'escape' | 'tab'> = {
  Enter: 'enter',
  Backspace: 'backspace',
  Escape: 'escape',
  Tab: 'tab',
};

/**
 * A session's device in a phone's frame (the preview pane's Simulator): the
 * bezel, the screen's live frame, and the reader's hand on it. A click
 * taps, a drag swipes at the pace it was made (a flick flings), and typing
 * with the screen focused types into the device. Points go out as fractions
 * of the screen, so nothing here knows the device's resolution. Until the
 * device's first picture arrives the screen is a plain box around `children`,
 * taking neither keys nor taps: there is nothing yet to touch, and a control
 * among the children keeps its own keys. Once there is a picture, `children`
 * is drawn over it without taking the pointer from it: the reconnecting
 * notice, while input made under it is held to send.
 */
export function DeviceFrame({
  label,
  frameUrl,
  onDrawn,
  onInput,
  onType,
  children,
}: {
  /** What a screen reader hears: "App running on Android emulator". */
  label: string;
  frameUrl: string | null;
  /** The frame on screen has been drawn: the credit for the next one. */
  onDrawn: () => void;
  onInput: (input: DeviceInput) => void;
  onType: (text: string) => void;
  /** What the screen says: in its place while it has no picture, over it once it has. */
  children?: ReactNode;
}) {
  // The press under way, point by point; read only by the handlers, so a
  // move costs no render.
  const trail = useRef<PointerSample[] | null>(null);

  // Where the pointer is on the device's screen, which is the image as drawn:
  // contained in the frame, so letterboxed when the device's shape is not
  // the frame's.
  const point = (event: PointerEvent<HTMLElement>): PointerSample => {
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
      t: event.timeStamp,
    };
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    trail.current = [point(event)];
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    trail.current?.push(point(event));
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const pressed = trail.current;
    if (!pressed) return;
    trail.current = null;
    const gesture = gestureOf([...pressed, point(event)]);
    if (gesture) onInput(gesture);
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
        {frameUrl ? (
          <section
            aria-label={label}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: the screen takes the reader's keys and pointer like a canvas does
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              trail.current = null;
            }}
            onKeyDown={onKeyDown}
            className="relative min-h-0 flex-1 cursor-pointer touch-none select-none overflow-hidden rounded-[48px] bg-device-bezel outline-none focus-visible:outline-2 focus-visible:outline-primary"
          >
            <img
              src={frameUrl}
              alt=""
              draggable={false}
              onLoad={onDrawn}
              className="pointer-events-none size-full object-contain"
            />
            {children}
          </section>
        ) : (
          <section
            aria-label={label}
            className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-hidden rounded-[48px] bg-device-bezel px-6 text-center"
          >
            {children}
          </section>
        )}
      </div>
    </div>
  );
}

import { useDebouncedCallback } from '@oppenheimer/design-system-web';
import type {
  DeviceInfo,
  DeviceInput,
  DeviceStatus,
  DeviceStream,
} from '@oppenheimer/frontend-consumer';
import { useSessionDeviceStream } from '@oppenheimer/frontend-consumer/react';
import { useEffect, useRef, useState } from 'react';

/** A screen frame on display: an object URL, and the credit owed once it is drawn. */
interface ShownFrame {
  url: string;
  drawn: () => void;
}

/** Typed characters are sent in bursts: each send is a round trip to the device. */
const TYPING_BURST_MS = 250;

/**
 * The session's device, live, for the preview pane: its status, which device
 * it is, the frame on screen, and the reader's input. The stream is built and
 * disposed by this hook's effect, which syncs with the device's socket.
 */
export function useSessionDevice(sessionId: string) {
  const open = useSessionDeviceStream(sessionId);
  const [status, setStatus] = useState<DeviceStatus>('connecting');
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [frame, setFrame] = useState<ShownFrame | null>(null);
  const streamRef = useRef<DeviceStream | null>(null);
  const typed = useRef('');

  // The device's socket: opened with the pane, closed with it.
  useEffect(() => {
    let stream: DeviceStream | null = null;
    let closed = false;
    // The frame on screen and the one waiting to be drawn. A frame replaced
    // before the image drew it is credited all the same: its bytes are
    // consumed, and a credit lost to a skipped frame would starve the stream.
    let shown: string | null = null;
    let waiting: { url: string; credit: () => void } | null = null;
    const subscribe = (opened: DeviceStream) => [
      opened.onStatus(setStatus),
      opened.onDevice(setDevice),
      opened.onFrame((blob, credit) => {
        if (waiting) {
          waiting.credit();
          URL.revokeObjectURL(waiting.url);
        }
        const url = URL.createObjectURL(blob);
        const frame = { url, credit };
        waiting = frame;
        setFrame({
          url,
          drawn: () => {
            if (waiting !== frame) return;
            waiting = null;
            credit();
            // The frame before this one is off screen once this one is drawn.
            if (shown) URL.revokeObjectURL(shown);
            shown = url;
          },
        });
      }),
    ];
    let unsubscribe: (() => void)[] = [];
    // The stream's code loads with the pane; one closed before it arrives
    // never opens a socket.
    void open().then((opened) => {
      if (closed) {
        opened.dispose();
        return;
      }
      stream = opened;
      streamRef.current = opened;
      unsubscribe = subscribe(opened);
    });
    return () => {
      closed = true;
      for (const off of unsubscribe) off();
      stream?.dispose();
      streamRef.current = null;
      if (shown) URL.revokeObjectURL(shown);
      if (waiting) URL.revokeObjectURL(waiting.url);
    };
  }, [open]);

  const flushTyping = useDebouncedCallback(() => {
    const text = typed.current;
    typed.current = '';
    if (text) streamRef.current?.input({ kind: 'text', text });
  }, TYPING_BURST_MS);

  const send = (input: DeviceInput) => {
    // Whatever was typed before this lands first.
    if (typed.current) {
      const text = typed.current;
      typed.current = '';
      streamRef.current?.input({ kind: 'text', text });
    }
    streamRef.current?.input(input);
  };

  const type = (text: string) => {
    typed.current += text;
    flushTyping();
  };

  return { status, device, frame, send, type };
}

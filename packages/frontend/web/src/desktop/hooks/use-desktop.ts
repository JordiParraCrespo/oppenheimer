import { useEffect, useRef, useState } from 'react';
import {
  type DesktopChannel,
  type DesktopViewState,
  desktopRetryDelay,
  isFinalDesktopStatus,
} from '../lib/desktop-channel';
import { loadRfb } from '../lib/load-novnc';

const CONNECTING: DesktopViewState = { status: 'connecting', control: false, refusal: null };

/**
 * A desktop on screen: noVNC drawing into `screenRef`'s element over a
 * channel from `connect`, dialled again with a growing wait while the host is
 * away or the dial dropped, and never after a final answer until `retry`.
 *
 * Its effect syncs with noVNC and the channel's socket: both are built in it
 * and torn down in its cleanup. noVNC loads with the first desktop shown.
 */
export function useDesktop(connect: () => Promise<DesktopChannel>) {
  const screenRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<DesktopChannel | null>(null);
  const [state, setState] = useState<DesktopViewState>(CONNECTING);
  const [generation, setGeneration] = useState(0);

  // noVNC and the desktop socket: built here, torn down on unmount or retry.
  useEffect(() => {
    // Read so a retry rebuilds the desktop, even with the same factory.
    void generation;
    let disposed = false;
    let attempt = 0;
    let latest = CONNECTING;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let teardown: (() => void) | null = null;

    const again = () => {
      if (disposed || isFinalDesktopStatus(latest.status)) return;
      timer = setTimeout(() => void dial(), desktopRetryDelay(attempt));
      attempt += 1;
    };

    const dial = async () => {
      latest = { ...latest, status: 'connecting' };
      setState(latest);
      let RFB: Awaited<ReturnType<typeof loadRfb>>;
      let channel: DesktopChannel;
      try {
        [RFB, channel] = await Promise.all([loadRfb(), connect()]);
      } catch {
        latest = { ...latest, status: 'dropped' };
        setState(latest);
        again();
        return;
      }
      const target = screenRef.current;
      if (disposed || !target) {
        channel.close();
        return;
      }
      channelRef.current = channel;
      const rfb = new RFB(target, channel, { shared: true });
      rfb.scaleViewport = true;
      rfb.resizeSession = false;
      rfb.viewOnly = true;
      rfb.background = 'transparent';
      const off = channel.onState((next) => {
        latest = next;
        setState(next);
        rfb.viewOnly = !next.control;
        if (next.status === 'live') attempt = 0;
      });
      const onDisconnect = () => {
        off();
        teardown = null;
        if (channelRef.current === channel) channelRef.current = null;
        again();
      };
      rfb.addEventListener('disconnect', onDisconnect);
      teardown = () => {
        rfb.removeEventListener('disconnect', onDisconnect);
        off();
        rfb.disconnect();
        channel.close();
      };
    };

    void dial();
    return () => {
      disposed = true;
      clearTimeout(timer);
      teardown?.();
      channelRef.current = null;
    };
  }, [connect, generation]);

  return {
    screenRef,
    state,
    /** Take control of the desktop, or go back to watching it. */
    setControl: (control: boolean) => channelRef.current?.setControl(control),
    /** Dial again after a final answer: the host's owner may have fixed it. */
    retry: () => setGeneration((n) => n + 1),
  };
}

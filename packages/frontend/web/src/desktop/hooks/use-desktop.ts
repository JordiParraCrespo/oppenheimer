/// <reference path="../lib/novnc.d.ts" />
import type { CursorImage } from '@novnc/novnc';
import { useEffect, useRef, useState } from 'react';
import {
  type DesktopChannel,
  type DesktopViewState,
  desktopRetryDelay,
  isFinalDesktopStatus,
} from '../lib/desktop-channel';
import { HostPointerOverlay } from '../lib/host-pointer';
import { loadRfb } from '../lib/load-novnc';

const CONNECTING: DesktopViewState = { status: 'connecting', control: false, refusal: null };

/**
 * A desktop on screen: noVNC drawing into `screenRef`'s element over a
 * channel from `connect`, dialled again with a growing wait while the host is
 * away or the dial dropped, and never after a final answer until `retry`.
 * While the reader watches, the host's pointer is drawn into `pointerRef`'s
 * canvas, over the screen (`HostPointerOverlay`).
 *
 * Its effect syncs with noVNC, the channel's socket and the screen's size:
 * all are built in it and torn down in its cleanup. noVNC loads with the
 * first desktop shown.
 */
export function useDesktop(connect: () => Promise<DesktopChannel>) {
  const screenRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLCanvasElement>(null);
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
      // noVNC first, the dial after it: a dial is under way from `connect`
      // on, and noVNC must be ready to take its first byte.
      let RFB: Awaited<ReturnType<typeof loadRfb>>;
      let channel: DesktopChannel;
      try {
        RFB = await loadRfb();
        channel = await connect();
      } catch {
        latest = { ...latest, status: 'dropped' };
        setState(latest);
        again();
        return;
      }
      const target = screenRef.current;
      const pointerCanvas = pointerRef.current;
      if (disposed || !target || !pointerCanvas) {
        channel.close();
        return;
      }
      let rfb: InstanceType<typeof RFB> | null = null;
      const pointer = new HostPointerOverlay(pointerCanvas, target);
      const offState = channel.onState((next) => {
        latest = next;
        setState(next);
        if (rfb) rfb.viewOnly = !next.control;
        pointer.setWatching(next.status === 'live' && !next.control);
        if (next.status === 'live') attempt = 0;
      });
      const offPointer = channel.onPointer((at) => pointer.setPointer(at));
      // noVNC rescales the screen with its element; the pointer follows it.
      let frame = 0;
      const resized = new ResizeObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => pointer.place());
      });
      resized.observe(target);
      const off = () => {
        offState();
        offPointer();
        resized.disconnect();
        cancelAnimationFrame(frame);
        pointer.dispose();
      };
      // A dial that already ended (refused, no ticket, the host away) is
      // answered by its state; noVNC refuses a closed channel.
      if (channel.readyState === 'closed') {
        off();
        again();
        return;
      }
      try {
        rfb = new RFB(target, channel, { shared: true });
      } catch {
        off();
        channel.close();
        latest = { ...latest, status: 'dropped' };
        setState(latest);
        again();
        return;
      }
      channelRef.current = channel;
      rfb.scaleViewport = true;
      rfb.resizeSession = false;
      rfb.viewOnly = !latest.control;
      rfb.background = 'transparent';
      const live = rfb;
      const onCursor = (event: Event) => {
        pointer.setShape((event as CustomEvent<CursorImage>).detail);
        // The framebuffer may have been drawn at a new size by now, too.
        const framebuffer = target.querySelector('canvas');
        if (framebuffer) resized.observe(framebuffer);
      };
      live.addEventListener('cursorimage', onCursor);
      const onDisconnect = () => {
        live.removeEventListener('cursorimage', onCursor);
        off();
        teardown = null;
        if (channelRef.current === channel) channelRef.current = null;
        again();
      };
      live.addEventListener('disconnect', onDisconnect);
      teardown = () => {
        live.removeEventListener('disconnect', onDisconnect);
        live.removeEventListener('cursorimage', onCursor);
        off();
        live.disconnect();
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
    pointerRef,
    state,
    /** Take control of the desktop, or go back to watching it. */
    setControl: (control: boolean) => channelRef.current?.setControl(control),
    /** Dial again after a final answer: the host's owner may have fixed it. */
    retry: () => setGeneration((n) => n + 1),
  };
}

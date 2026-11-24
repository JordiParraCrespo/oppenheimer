import { VISUAL_FRAME_MAX_HEIGHT } from '@oppenheimer/shared/schemas/visual';
import { useEffect, useRef, useState } from 'react';
import { visualTheme } from '../lib/visual-theme';

/** How long the page has to say it is ready before the frame gives up. */
const LOAD_TIMEOUT_MS = 15_000;

type FrameMessage =
  | { type: 'ready' }
  | { type: 'size'; height: number }
  | { type: 'error'; message: string }
  | { type: 'navigated' }
  | { type: 'open-link'; href: string };

function frameMessage(data: unknown): FrameMessage | null {
  if (typeof data !== 'object' || data === null) return null;
  const message = data as Record<string, unknown>;
  switch (message.type) {
    case 'ready':
      return { type: 'ready' };
    case 'size':
      return typeof message.height === 'number' && Number.isFinite(message.height)
        ? { type: 'size', height: message.height }
        : null;
    case 'navigated':
      return { type: 'navigated' };
    case 'error':
      return { type: 'error', message: String(message.message ?? '').slice(0, 300) };
    case 'open-link':
      return typeof message.href === 'string' && /^https?:\/\//i.test(message.href)
        ? { type: 'open-link', href: message.href.slice(0, 2048) }
        : null;
    default:
      return null;
  }
}

/**
 * The window messages between the console and one visual's frame (the
 * visuals origin's page): the fragment and the theme posted in when the page
 * is ready, the theme again whenever the console's changes, and its height,
 * its errors and the links it asks to open taken back, from that frame's
 * window alone. A page that never says it is ready fails after 15 seconds;
 * the frame loads at once (never lazily), so that clock and its load start together.
 */
export function useVisualFrame(html: string, firstHeight: number) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(firstHeight);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    const frameWindow = () => frame.current?.contentWindow ?? null;
    // A sandboxed frame's origin is opaque ("null"): it is addressed, and known, by its window.
    const post = (message: unknown) => frameWindow()?.postMessage(message, '*');
    const onMessage = (event: MessageEvent) => {
      if (!frameWindow() || event.source !== frameWindow()) return;
      const message = frameMessage(event.data);
      if (message?.type === 'ready') post({ type: 'render', html, ...visualTheme() });
      if (message?.type === 'size') {
        setHeight(Math.max(40, Math.min(VISUAL_FRAME_MAX_HEIGHT, Math.ceil(message.height))));
        setState('ready');
      }
      if (message?.type === 'error') setError(message.message);
      if (message?.type === 'open-link') setLink(message.href);
      // The page tried to leave its frame; its shell has already ended it.
      if (message?.type === 'navigated') setState('failed');
    };
    window.addEventListener('message', onMessage);
    const theme = new MutationObserver(() => post({ type: 'theme', ...visualTheme() }));
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });
    const timeout = window.setTimeout(
      () => setState((current) => (current === 'loading' ? 'failed' : current)),
      LOAD_TIMEOUT_MS,
    );
    return () => {
      window.removeEventListener('message', onMessage);
      theme.disconnect();
      window.clearTimeout(timeout);
    };
  }, [html]);

  return { frame, height, state, error, link, closeLink: () => setLink(null) };
}

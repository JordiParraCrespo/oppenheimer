import '@xterm/xterm/css/xterm.css';
import type { SessionStream, StreamEnd, StreamStatus } from '@oppenheimer/frontend-consumer';
import { useEffect, useRef, useState } from 'react';
import { mountSessionTerminal } from '../lib/terminal-runtime';

/**
 * Mounts a session terminal in `containerRef` for as long as the component
 * lives, and reports the stream's status.
 *
 * The terminal itself — xterm, its fit, the anchor, keys, renderer, fonts
 * and theme — is `mountSessionTerminal`. What this adds is the React side:
 * one effect synchronising that imperative runtime with the component's
 * lifetime, and the one piece of state the pane renders: the link status.
 *
 * The grid's size is deliberately not state. A refit runs once per animation
 * frame while the pane is resized, and state set there re-rendered the pane
 * sixty times a second for a value nobody drew; the runtime hands the size
 * straight to the PTY instead.
 *
 * The stream is *created* here rather than passed in, so that one effect owns
 * one lifetime. A stream held in state and closed by a second effect does not
 * survive StrictMode's remount: the cleanup closes it, and the terminal that
 * mounts next subscribes to something already shut, which renders blank in
 * development and nowhere else. `createStream` must be a stable reference.
 *
 * `retryNow` is the reader's way past a wait: while the stream is between
 * reconnects it dials at once, and after an end it opens a new stream. The
 * browser coming back online, or the tab becoming visible again, does the
 * first on its own — a laptop that wakes should not sit out a thirty-second
 * rung of the ladder.
 */
export function useTerminal(
  createStream: () => SessionStream,
  options: {
    onEnd?: (reason: StreamEnd) => void;
    agentWindow?: boolean;
    onImage?: (image: File) => void;
  } = {},
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<StreamStatus>('connecting');
  // Whether the far end has said anything on this attachment. A live link with
  // nothing on it is an agent still starting, and that is not the same picture
  // as a terminal — see `onFirstOutput`.
  const [hasOutput, setHasOutput] = useState(false);
  // Why the stream ended, if it has; cleared by a retry that opens a new one.
  const [ended, setEnded] = useState<StreamEnd | null>(null);
  // Bumped to open a new stream after an end.
  const [generation, setGeneration] = useState(0);
  const streamRef = useRef<SessionStream | null>(null);
  // Read through a ref so a new callback identity never rebuilds the terminal.
  // Written after commit, not during render: a ref written in render is one of
  // the things the React Compiler silently refuses to compile.
  const onEndRef = useRef(options.onEnd);
  const onImageRef = useRef(options.onImage);
  useEffect(() => {
    onEndRef.current = options.onEnd;
    onImageRef.current = options.onImage;
  });
  const agentWindow = options.agentWindow ?? false;

  // `generation` is read only to re-run: a retry after an end is a new stream.
  // biome-ignore lint/correctness/useExhaustiveDependencies: generation is the re-run key
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const stream = createStream();
    streamRef.current = stream;
    const unmount = mountSessionTerminal(container, stream, {
      agentWindow,
      onImage: (image) => onImageRef.current?.(image),
      // A reconnect replays the scrollback, so a session that has already run
      // answers this on its first frame and the waiting state never shows.
      onFirstOutput: () => setHasOutput(true),
    });
    const offStatus = stream.onStatus(setStatus);
    const offEnd = stream.onEnd((reason) => {
      setEnded(reason);
      onEndRef.current?.(reason);
    });
    // The browser's connectivity and the tab's visibility: either coming back
    // is a reason to stop waiting on the ladder.
    const wake = () => {
      if (document.visibilityState === 'visible') stream.reconnectNow();
    };
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', wake);

    return () => {
      window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', wake);
      offStatus();
      offEnd();
      unmount();
      stream.dispose();
      if (streamRef.current === stream) streamRef.current = null;
    };
  }, [createStream, agentWindow, generation]);

  const retryNow = () => {
    if (ended) {
      setEnded(null);
      setHasOutput(false);
      setGeneration((current) => current + 1);
      return;
    }
    streamRef.current?.reconnectNow();
  };

  return { containerRef, status, hasOutput, ended, retryNow };
}

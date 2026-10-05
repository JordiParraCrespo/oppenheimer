import '@xterm/xterm/css/xterm.css';
import type { SessionStream, StreamEnd, StreamStatus } from '@oppenheimer/frontend-consumer';
import { useEffect, useRef, useState } from 'react';
import { mountSessionTerminal } from '../lib/terminal-runtime';

/**
 * Mounts a session terminal (`mountSessionTerminal`) in `containerRef` for the
 * component's lifetime and reports the link status.
 *
 * The grid's size is deliberately not state: a refit runs once per animation
 * frame during a resize, and state there re-rendered the pane sixty times a
 * second; the runtime hands the size straight to the PTY.
 *
 * The stream is *created* here so one effect owns one lifetime: a stream held
 * in state and closed by a second effect does not survive StrictMode's
 * remount, and the next terminal renders blank in development.
 * `createStream` must be a stable reference.
 *
 * `retryNow` dials at once between reconnects and opens a new stream after an
 * end. Coming back online or visible does the first on its own, so a waking
 * laptop does not sit out a thirty-second rung of the ladder.
 */
export function useTerminal(
  createStream: () => SessionStream,
  options: {
    onEnd?: (reason: StreamEnd) => void;
    agentWindow?: boolean;
    onImages?: (images: File[]) => void;
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
  const onEndRef = useRef(options.onEnd);
  const onImagesRef = useRef(options.onImages);
  useEffect(() => {
    onEndRef.current = options.onEnd;
    onImagesRef.current = options.onImages;
  });
  const agentWindow = options.agentWindow ?? false;

  // biome-ignore lint/correctness/useExhaustiveDependencies: generation is the re-run key
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const stream = createStream();
    streamRef.current = stream;
    const unmount = mountSessionTerminal(container, stream, {
      agentWindow,
      onImages: (images) => onImagesRef.current?.(images),
      // A reconnect replays the scrollback, so a session that has already run
      // answers this on its first frame and the waiting state never shows.
      onFirstOutput: () => setHasOutput(true),
    });
    const offStatus = stream.onStatus(setStatus);
    const offEnd = stream.onEnd((reason) => {
      setEnded(reason);
      onEndRef.current?.(reason);
    });
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

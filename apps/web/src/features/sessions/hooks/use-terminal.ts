import '@xterm/xterm/css/xterm.css';
import type { SessionStream, StreamEnd, StreamStatus } from '@oppenheimer/frontend-consumer';
import { useHostPresence } from '@oppenheimer/frontend-consumer/react';
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
 *
 * With `hostId`, an `offline` link also watches the host list, and a poll that
 * finds the host online redials the same way, so a reader who has just brought
 * the runner back is not left on that rung either. Only a poll answered after
 * the link went offline counts: the list read before it is the one that still
 * called the host online, and redialling on it would only meet `host_offline`
 * again. Not an offline→online edge either, because the API calls a host
 * online for thirty seconds after its last heartbeat, so a runner restarted
 * inside that window never reads offline at all. `hostName` is the list's
 * name for it, for the pane to say which machine it is waiting on.
 */
export function useTerminal(
  createStream: () => SessionStream,
  options: {
    onEnd?: (reason: StreamEnd) => void;
    agentWindow?: boolean;
    onImage?: (image: File) => void;
    hostId?: string;
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
  const onImageRef = useRef(options.onImage);
  useEffect(() => {
    onEndRef.current = options.onEnd;
    onImageRef.current = options.onImage;
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

  const hostId = options.hostId;
  const presence = useHostPresence({
    watching: hostId !== undefined && status === 'offline',
    select: (hosts) => hosts.find((host) => host.id === hostId),
  });
  const hostOnline = presence.data?.online ?? false;
  const answeredAt = presence.dataUpdatedAt;
  // When the link went offline, so a list read from before it is not taken
  // for the host coming back.
  const offlineSince = useRef<number | null>(null);
  useEffect(() => {
    if (status !== 'offline') {
      offlineSince.current = null;
      return;
    }
    offlineSince.current ??= Date.now();
    if (hostOnline && answeredAt > offlineSince.current) streamRef.current?.reconnectNow();
  }, [status, hostOnline, answeredAt]);

  const retryNow = () => {
    if (ended) {
      setEnded(null);
      setHasOutput(false);
      setGeneration((current) => current + 1);
      return;
    }
    streamRef.current?.reconnectNow();
  };

  return { containerRef, status, hasOutput, ended, retryNow, hostName: presence.data?.name };
}

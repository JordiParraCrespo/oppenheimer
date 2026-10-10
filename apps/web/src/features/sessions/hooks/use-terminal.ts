import '@xterm/xterm/css/xterm.css';
import type { SessionStream, StreamEnd, StreamStatus } from '@oppenheimer/frontend-consumer';
import { useHostPresence } from '@oppenheimer/frontend-consumer/react';
import { useEffect, useRef, useState } from 'react';
import { RECONNECTED_FOR_MS } from '../lib/host-link-phase';
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
 * the link went away counts: the list read before it is the one that still
 * called the host online, and redialling on it would only meet `host_offline`
 * again. Not an offline→online edge either, because the API calls a host
 * online for thirty seconds after its last heartbeat, so a runner restarted
 * inside that window never reads offline at all.
 *
 * What the pane draws of all this (`hostLinkPhaseOf`) is read off the rest of
 * the return: `awaySince`, when the link went offline and until it is live
 * again; `reconnected`, the link came back from being away a moment ago;
 * `hostName`, the list's name for it.
 */
export function useTerminal(
  createStream: () => SessionStream,
  options: {
    onEnd?: (reason: StreamEnd) => void;
    agentWindow?: boolean;
    onFiles?: (files: File[]) => void;
    hostId?: string;
    /** A watcher's pane: no input (`SessionTerminalOptions.readOnly`). */
    readOnly?: boolean;
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
  // When the link went offline, held until it is live again; the ref is what
  // the status listener reads, the state what the pane draws.
  const awayRef = useRef<number | null>(null);
  const [awaySince, setAwaySince] = useState<number | null>(null);
  // The link came back from being away, for the moment the pane says so.
  const [reconnected, setReconnected] = useState(false);
  // Bumped to open a new stream after an end.
  const [generation, setGeneration] = useState(0);
  const streamRef = useRef<SessionStream | null>(null);
  // Read through a ref so a new callback identity never rebuilds the terminal.
  const onEndRef = useRef(options.onEnd);
  const onFilesRef = useRef(options.onFiles);
  useEffect(() => {
    onEndRef.current = options.onEnd;
    onFilesRef.current = options.onFiles;
  });
  const agentWindow = options.agentWindow ?? false;
  const readOnly = options.readOnly ?? false;

  // biome-ignore lint/correctness/useExhaustiveDependencies: generation is the re-run key
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const stream = createStream();
    streamRef.current = stream;
    const unmount = mountSessionTerminal(container, stream, {
      agentWindow,
      readOnly,
      onFiles: (files) => onFilesRef.current?.(files),
      // A reconnect replays the scrollback, so a session that has already run
      // answers this on its first frame and the waiting state never shows.
      onFirstOutput: () => setHasOutput(true),
    });
    const offStatus = stream.onStatus((next) => {
      setStatus(next);
      if (next === 'offline' && awayRef.current === null) {
        awayRef.current = Date.now();
        setAwaySince(awayRef.current);
      } else if (next === 'live' && awayRef.current !== null) {
        awayRef.current = null;
        setAwaySince(null);
        setReconnected(true);
      } else if (next === 'closed') {
        awayRef.current = null;
        setAwaySince(null);
      }
    });
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
  }, [createStream, agentWindow, readOnly, generation]);

  const hostId = options.hostId;
  // No host, no list to watch: a shared pane's holder may not be signed in,
  // and the hosts are not theirs to read.
  const presence = useHostPresence({
    enabled: hostId !== undefined,
    watching: hostId !== undefined && status === 'offline',
    select: (hosts) => hosts.find((host) => host.id === hostId),
  });
  const hostOnline = presence.data?.online ?? false;
  const answeredAt = presence.dataUpdatedAt;
  const hostBack =
    status === 'offline' && hostOnline && awaySince !== null && answeredAt > awaySince;
  useEffect(() => {
    if (hostBack) streamRef.current?.reconnectNow();
  }, [hostBack]);

  useEffect(() => {
    if (!reconnected) return;
    const timer = setTimeout(() => setReconnected(false), RECONNECTED_FOR_MS);
    return () => clearTimeout(timer);
  }, [reconnected]);

  const retryNow = () => {
    if (ended) {
      setEnded(null);
      setHasOutput(false);
      setGeneration((current) => current + 1);
      return;
    }
    streamRef.current?.reconnectNow();
  };

  return {
    containerRef,
    status,
    hasOutput,
    ended,
    retryNow,
    hostName: presence.data?.name,
    awaySince,
    reconnected,
  };
}

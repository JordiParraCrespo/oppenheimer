import '@xterm/xterm/css/xterm.css';
import type { SessionStream, StreamEnd, StreamStatus } from '@oppenheimer/frontend-consumer';
import { useEffect, useRef, useState } from 'react';
import { mountSessionTerminal, type TerminalGrid } from '../lib/terminal-runtime';

export type { TerminalGrid } from '../lib/terminal-runtime';

/**
 * Mounts a session terminal in `containerRef` for as long as the component
 * lives, and reports the stream's status and the grid's size.
 *
 * The terminal itself — xterm, its fit, the anchor, keys, renderer, fonts
 * and theme — is `mountSessionTerminal`. What this adds is the React side:
 * one effect synchronising that imperative runtime with the component's
 * lifetime, and the two pieces of state the pane renders.
 *
 * The stream is *created* here rather than passed in, so that one effect owns
 * one lifetime. A stream held in state and closed by a second effect does not
 * survive StrictMode's remount: the cleanup closes it, and the terminal that
 * mounts next subscribes to something already shut, which renders blank in
 * development and nowhere else. `createStream` must be a stable reference.
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
  const [grid, setGrid] = useState<TerminalGrid>({ cols: 0, rows: 0 });
  // Read through a ref so a new callback identity never rebuilds the terminal.
  const onEndRef = useRef(options.onEnd);
  onEndRef.current = options.onEnd;
  const onImageRef = useRef(options.onImage);
  onImageRef.current = options.onImage;
  const agentWindow = options.agentWindow ?? false;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const stream = createStream();
    const unmount = mountSessionTerminal(container, stream, {
      onGrid: setGrid,
      agentWindow,
      onImage: (image) => onImageRef.current?.(image),
    });
    const offStatus = stream.onStatus(setStatus);
    const offEnd = stream.onEnd((reason) => onEndRef.current?.(reason));

    return () => {
      offStatus();
      offEnd();
      unmount();
      stream.dispose();
    };
  }, [createStream, agentWindow]);

  return { containerRef, status, grid };
}

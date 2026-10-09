import { useCallback } from 'react';
import type { SessionStream } from '../modules/sessions';
import { useConsumerApp } from './context';

/**
 * A stable factory for one window's terminal stream.
 *
 * A factory rather than a stream so the component that mounts the terminal
 * creates it inside its own effect and disposes it in that effect's cleanup:
 * one effect, one lifetime, which is what survives StrictMode's remount. The
 * identity changes only when the session or the window does.
 */
export function useSessionStream(sessionId: string, window = 0): () => SessionStream {
  const app = useConsumerApp();
  return useCallback(() => app.sessions.openStream(sessionId, window), [app, sessionId, window]);
}

/**
 * Mint a session window's attach ticket ahead of the click that opens it
 * (`SessionsService.primeAttachTicket`). Stable for the app's lifetime.
 */
export function usePrimeSessionStream(): (sessionId: string, window?: number) => void {
  const app = useConsumerApp();
  return useCallback(
    (sessionId: string, window = 0) => app.sessions.primeAttachTicket(sessionId, window),
    [app],
  );
}

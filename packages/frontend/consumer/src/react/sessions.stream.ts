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

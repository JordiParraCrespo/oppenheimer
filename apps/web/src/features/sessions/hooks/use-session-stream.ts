import { useConsumerApp } from '@oppenheimer/frontend-consumer/react';
import { useCallback } from 'react';
import { createSessionStream, type SessionStream } from '../lib/session-stream';

// Same-origin by default; `VITE_API_URL` only when the API lives elsewhere
// (`src/lib/oppenheimer.ts` reads the same variable for the HTTP client).
const apiBaseUrl = import.meta.env.VITE_API_URL ?? '';

/**
 * A stable factory for one session's terminal stream.
 *
 * `useTerminal` creates the stream inside its own effect and re-creates it
 * whenever the factory's identity changes, so this must change only when the
 * session or the window does — which is what the `useCallback` deps say.
 */
export function useSessionStream(sessionId: string, window = 0): () => SessionStream {
  const app = useConsumerApp();
  return useCallback(
    () =>
      createSessionStream({
        apiBaseUrl,
        issueTicket: () => app.sessions.issueAttachTicket(sessionId, window),
      }),
    [app, sessionId, window],
  );
}

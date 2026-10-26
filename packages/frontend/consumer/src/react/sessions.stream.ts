import { useFeatureFlag } from '@oppenheimer/frontend-core/react';
import { useCallback, useEffect, useRef } from 'react';
import type { DeviceStream, SessionStream } from '../modules/sessions';
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
  // Read through a ref, asked at each offer: the flags arriving after the
  // terminal mounted must not change the factory, which would rebuild it.
  const direct = useFeatureFlag('terminal_direct_path');
  const directRef = useRef(direct);
  useEffect(() => {
    directRef.current = direct;
  });
  return useCallback(
    () => app.sessions.openStream(sessionId, window, { direct: () => directRef.current }),
    [app, sessionId, window],
  );
}

/**
 * A stable factory for the session's device stream, built and disposed by
 * the effect that shows it, as a terminal's is.
 */
export function useSessionDeviceStream(sessionId: string): () => DeviceStream {
  const app = useConsumerApp();
  return useCallback(() => app.sessions.openDeviceStream(sessionId), [app, sessionId]);
}

/**
 * {@link useSessionStream} through a share: each ticket minted at its
 * address, always for the agent's window, the one a share opens.
 */
export function useSharedSessionStream(slug: string): () => SessionStream {
  const app = useConsumerApp();
  return useCallback(() => app.sessions.openSharedStream(slug), [app, slug]);
}

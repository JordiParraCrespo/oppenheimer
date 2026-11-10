import { useCallback } from 'react';
import type { AttachDesktopConnection } from '../modules/hosts';
import { useConsumerApp } from './context';

/**
 * A stable factory for one dial to a host's desktop, called by the viewer's
 * effect each time it (re)connects, as a terminal's stream is: one effect,
 * one lifetime. The identity changes only when the host does.
 */
export function useHostDesktop(hostId: string): () => Promise<AttachDesktopConnection> {
  const app = useConsumerApp();
  return useCallback(() => app.hostDesktops.openDesktop(hostId), [app, hostId]);
}

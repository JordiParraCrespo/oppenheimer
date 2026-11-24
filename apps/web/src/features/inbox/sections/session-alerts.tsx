import { useSessionAlerts } from '@/features/inbox/hooks/use-session-alerts';

/**
 * The console's system notifications for sessions that wait on the reader.
 * Draws nothing; mounted once, under the workspace gate, so it hears every
 * page.
 */
export function SessionAlerts() {
  useSessionAlerts();
  return null;
}

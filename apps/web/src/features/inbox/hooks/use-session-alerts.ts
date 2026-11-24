import { useNow } from '@oppenheimer/design-system-web';
import { newSessionItems, type SessionEntity, sessionItems } from '@oppenheimer/frontend-consumer';
import {
  useInboxAlertsOn,
  useMutedSessionAlerts,
  useSessions,
} from '@oppenheimer/frontend-consumer/react';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { inboxCopy } from '@/features/inbox/lib/inbox-copy';
import {
  alertText,
  type SessionWatch,
  shouldAlert,
  watchSessions,
} from '@/features/inbox/lib/session-alerts';

/** How often the stale reminder looks again while the list itself does not move. */
const STALE_TICK_MS = 60_000;

/**
 * Synchronises the session list with the browser's Notification API: one
 * system notification for each session that comes to wait on the reader, each
 * notice an agent sends, each turn that ends (the row's dot goes blue), and
 * one reminder for a session that has needed the reader for thirty minutes,
 * while this tab is not the one in front. A session the reader muted from its
 * row is never told. A click brings the tab forward on that session. What was
 * already waiting when the console opened is remembered, never announced.
 */
export function useSessionAlerts(): void {
  const [on] = useInboxAlertsOn();
  const [muted] = useMutedSessionAlerts();
  const { data: sessions } = useSessions();
  const seen = useRef<Set<string> | null>(null);
  const watches = useRef<Map<string, SessionWatch> | null>(null);
  // A session that sits still turns stale with no change to the list: the
  // minute clock is what looks again.
  const now = useNow(STALE_TICK_MS);
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessions) return;
    const { fresh, seen: next } = newSessionItems(seen.current, sessionItems(sessions));
    seen.current = next;
    const looked = watchSessions(watches.current, sessions, now);
    watches.current = looked.watches;

    const alerts: { key: string; session: SessionEntity; title: string; body: string }[] = [
      ...fresh.map((item) => ({
        key: item.key,
        session: item.session,
        ...alertText(inboxCopy(item, t)),
      })),
      ...looked.done.map((session) => ({
        key: `done:${session.id}`,
        session,
        title: t('inbox.alert.doneTitle', { name: session.name }),
        body: t('inbox.alert.doneBody'),
      })),
      ...looked.stale.map((session) => ({
        key: `stale:${session.id}`,
        session,
        title: t('inbox.alert.staleTitle', { name: session.name }),
        body: t('inbox.alert.staleBody'),
      })),
    ].filter((alert) => !muted.has(alert.session.id));
    if (alerts.length === 0 || !shouldAlert(on, globalThis.Notification?.permission, document))
      return;
    for (const alert of alerts) {
      let notification: Notification;
      try {
        notification = new Notification(alert.title, { body: alert.body, tag: alert.key });
      } catch {
        // Android's Chrome has the constructor but refuses it (a page there
        // can only notify through a service worker); the Inbox still has it.
        return;
      }
      notification.onclick = () => {
        window.focus();
        notification.close();
        void navigate({ to: '/sessions/$sessionId', params: { sessionId: alert.session.id } });
      };
    }
  }, [sessions, now, on, muted, t, navigate]);
}

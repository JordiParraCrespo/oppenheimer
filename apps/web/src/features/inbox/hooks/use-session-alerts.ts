import { newSessionItems, sessionItems } from '@oppenheimer/frontend-consumer';
import { useInboxAlertsOn, useSessions } from '@oppenheimer/frontend-consumer/react';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { inboxCopy } from '@/features/inbox/lib/inbox-copy';
import { alertText, shouldAlert } from '@/features/inbox/lib/session-alerts';

/**
 * Synchronises the session list with the browser's Notification API: one
 * system notification for each session that comes to wait on the reader, and
 * each notice an agent sends, while this tab is not the one in front. A click
 * brings the tab forward on that session. What was already waiting when the
 * console opened is remembered, never announced.
 */
export function useSessionAlerts(): void {
  const [on] = useInboxAlertsOn();
  const { data: sessions } = useSessions();
  const seen = useRef<Set<string> | null>(null);
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessions) return;
    const { fresh, seen: next } = newSessionItems(seen.current, sessionItems(sessions));
    seen.current = next;
    if (fresh.length === 0 || !shouldAlert(on, globalThis.Notification?.permission, document))
      return;
    for (const item of fresh) {
      const { title, body } = alertText(inboxCopy(item, t));
      let notification: Notification;
      try {
        notification = new Notification(title, { body, tag: item.key });
      } catch {
        // Android's Chrome has the constructor but refuses it (a page there
        // can only notify through a service worker); the Inbox still has it.
        return;
      }
      notification.onclick = () => {
        window.focus();
        notification.close();
        void navigate({ to: '/sessions/$sessionId', params: { sessionId: item.session.id } });
      };
    }
  }, [sessions, on, t, navigate]);
}

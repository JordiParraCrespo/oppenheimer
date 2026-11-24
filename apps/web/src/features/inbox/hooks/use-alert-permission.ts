import { useInboxAlertsOn } from '@oppenheimer/frontend-consumer/react';
import { useEffect, useState } from 'react';
import type { AlertSwitch } from '@/features/inbox/lib/session-alerts';

/**
 * Synchronises the notify switch with the browser's notification permission:
 * turning it on asks for permission, and a permission revoked in the
 * browser's settings shows as blocked rather than on.
 */
export function useAlertSwitch(): [AlertSwitch, (on: boolean) => void] {
  const [on, setOn] = useInboxAlertsOn();
  const supported = typeof globalThis.Notification !== 'undefined';
  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : 'denied',
  );

  useEffect(() => {
    if (!supported || !navigator.permissions) return;
    let status: PermissionStatus | undefined;
    const sync = () => setPermission(Notification.permission);
    void navigator.permissions.query({ name: 'notifications' }).then(
      (answer) => {
        status = answer;
        answer.addEventListener('change', sync);
      },
      () => undefined,
    );
    return () => status?.removeEventListener('change', sync);
  }, [supported]);

  const change = (next: boolean) => {
    if (!next) return setOn(false);
    if (Notification.permission === 'granted') return setOn(true);
    void Notification.requestPermission().then((answer) => {
      setPermission(answer);
      setOn(answer === 'granted');
    });
  };

  if (!supported) return ['unsupported', change];
  if (permission === 'denied') return ['blocked', change];
  return [on && permission === 'granted' ? 'on' : 'off', change];
}

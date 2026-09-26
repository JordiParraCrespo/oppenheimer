import { useNow } from '@oppenheimer/design-system-web';
import { formatRelativeTime, useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The mono line under a host's state: "connected · 41 ms" while its link is
 * up, "last seen 2 days ago" once it is not, "never connected" before its
 * first link. Its own leaf because it is the one thing on the card on a clock:
 * a minute's tick redraws this line, not the card around it.
 */
export function HostSeen({
  online,
  lastSeenAt,
  roundTripMillis,
}: {
  online: boolean;
  lastSeenAt: Date | null;
  roundTripMillis: number | null;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(60_000);

  if (online) {
    return roundTripMillis !== null
      ? t('hosts.settings.seen.connectedRtt', { ms: roundTripMillis })
      : t('hosts.settings.seen.connected');
  }
  if (!lastSeenAt) return t('hosts.settings.seen.never');
  const when = formatRelativeTime(lastSeenAt, locale, new Date(now));
  // Within the last minute and already offline: the relative word is "now".
  return t('hosts.settings.seen.lastSeen', {
    when: when ?? t('hosts.settings.seen.connected'),
  });
}

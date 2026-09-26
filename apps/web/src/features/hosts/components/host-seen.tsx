import { useNow } from '@oppenheimer/design-system-web';
import { formatRelativeTime, useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The mono line under a host's state, as the frame words it: "connected"
 * while its link is up, "last seen 2 days ago" once it is not. A host that
 * has never connected has no time to give, and the line is left empty. Its
 * own leaf because it is the one thing on the card on a clock: a minute's
 * tick redraws this line, not the card around it.
 */
export function HostSeen({ online, lastSeenAt }: { online: boolean; lastSeenAt: Date | null }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(60_000);

  if (online) return t('hosts.settings.seen.connected');
  if (!lastSeenAt) return null;
  const when = formatRelativeTime(lastSeenAt, locale, new Date(now));
  return t('hosts.settings.seen.lastSeen', { when: when ?? t('hosts.settings.seen.now') });
}

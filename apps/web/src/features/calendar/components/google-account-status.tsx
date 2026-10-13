import { useNow } from '@oppenheimer/design-system-web';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { formatAge } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import type { AccountRowState } from '../lib/google-accounts';

/**
 * How one Google account stands, under its address: "Updated 2m ago" from
 * the last read, on a minute clock of its own so the list never re-renders
 * for it; "Needs reconnecting" or "Couldn’t read it just now" otherwise.
 */
export function GoogleAccountStatus({
  state,
  updatedAt,
}: {
  state: AccountRowState;
  updatedAt: number;
}) {
  const { t } = useTranslation();
  const now = useNow(CORE_CONFIG.clock.everyMinuteMs);
  if (state === 'revoked') return t('calendar.google.needsReconnect');
  if (state === 'failed') return t('calendar.google.readFailed');
  if (!updatedAt) return t('calendar.google.connected');
  const age = formatAge(new Date(updatedAt), now, t);
  return now - updatedAt < 60_000
    ? t('calendar.google.updatedNow')
    : t('calendar.google.updated', { age });
}

import { useNow } from '@oppenheimer/design-system-web';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { formatRelativeTime, useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * When a chat last wrote, in words ("3 hours ago"), kept current by a clock
 * of its own so the minute ticking redraws this and not the row. A chat
 * allowed before any message says so.
 */
export function ChatLastSeen({ at }: { at: Date | null }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(CORE_CONFIG.clock.everyMinuteMs);
  if (!at) return <>{t('settings.whatsapp.chats.noMessages')}</>;
  return (
    <>{formatRelativeTime(at, locale, new Date(now)) ?? t('settings.whatsapp.chats.justNow')}</>
  );
}

import { useNow } from '@oppenheimer/design-system-web';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { botRowTime } from '@/features/bots/lib/row-time';

/**
 * When a bot was last active, at the end of its sidebar row's name
 * (`botRowTime`). It holds the minute's clock itself, so the tick redraws
 * these words and not the row.
 */
export function BotRowTime({ at }: { at: Date }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(CORE_CONFIG.clock.everyMinuteMs);
  const time = botRowTime(at, now, locale);
  return time === 'yesterday' ? t('bots.sidebar.yesterday') : time;
}

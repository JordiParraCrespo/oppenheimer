import { TranscriptDivider } from '@oppenheimer/design-system-web';
import { Shrink } from '@oppenheimer/design-system-web/icons';
import { formatTokens, useLocale } from '@oppenheimer/frontend-web';
import type { BotCompactionEvent } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';

/**
 * A turn folded what it had read into a summary (`25-bots.md` §2,
 * "Compaction"): "Summarized earlier work to keep its context small · 92K →
 * 21K tokens", where it happened among the turn's calls, so the person can
 * tell why the bot no longer quotes a detail it read before.
 */
export function CompactionEventLine({ event }: { event: BotCompactionEvent }) {
  const { t } = useTranslation();
  const locale = useLocale();
  return (
    <TranscriptDivider icon={<Shrink />}>
      {t('bots.chat.event.compaction', {
        before: formatTokens(event.tokensBefore, locale),
        after: formatTokens(event.tokensAfter, locale),
      })}
    </TranscriptDivider>
  );
}

import { Trace, TraceStep } from '@oppenheimer/design-system-web';
import { Shrink } from '@oppenheimer/design-system-web/icons';
import { formatTokens, useLocale } from '@oppenheimer/frontend-web';
import type { BotCompactionEvent } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';

/**
 * A turn folded what it had read into a summary (`25-bots.md` §2,
 * "Compaction"): one quiet line among the turn's calls, drawn like them,
 * "Summarized earlier work · 92K → 21K tokens", so the person can tell why
 * the bot no longer quotes a detail it read before without a rule across
 * the chat.
 */
export function CompactionEventLine({ event }: { event: BotCompactionEvent }) {
  const { t } = useTranslation();
  const locale = useLocale();
  return (
    <Trace>
      <TraceStep
        icon={<Shrink />}
        title={t('bots.chat.event.compactionLine')}
        meta={t('bots.chat.event.compactionTokens', {
          before: formatTokens(event.tokensBefore, locale),
          after: formatTokens(event.tokensAfter, locale),
        })}
      />
    </Trace>
  );
}

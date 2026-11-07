import { TranscriptDivider } from '@oppenheimer/design-system-web';
import { RotateCcw, Sparkles } from '@oppenheimer/design-system-web/icons';
import type { BotDreamEvent } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';

/**
 * A dream of the bot's memory (`25-bots.md` §4.1, "Dreaming"): "Tidied its
 * memory · 40 facts → 22", or that you undid it.
 */
export function DreamEventLine({ event }: { event: BotDreamEvent }) {
  const { t } = useTranslation();
  return (
    <TranscriptDivider icon={event.activity === 'undone' ? <RotateCcw /> : <Sparkles />}>
      {t(`bots.chat.event.dream.${event.activity}`, {
        before: event.factsBefore,
        after: event.factsAfter,
      })}
    </TranscriptDivider>
  );
}

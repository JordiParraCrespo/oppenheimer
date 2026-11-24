import { TranscriptDivider } from '@oppenheimer/design-system-web';
import { Eye } from '@oppenheimer/design-system-web/icons';
import type { BotCheckBackEvent } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';

/**
 * A look the bot asked for with `check_back`, opening its turn: "Checked
 * back on: <what it waits on>", in its own words, as a session's look reads
 * "Checked on session".
 */
export function CheckBackEventLine({ event }: { event: BotCheckBackEvent }) {
  const { t } = useTranslation();
  return (
    <TranscriptDivider icon={<Eye />}>
      <span className="max-w-xl truncate" title={event.about}>
        {t('bots.chat.event.checkBack', { about: event.about })}
      </span>
    </TranscriptDivider>
  );
}

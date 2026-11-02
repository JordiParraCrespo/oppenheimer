import { TraceLive } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { BotTurnClock } from '@/features/bots/components/bot-turn-clock';
import type { RunningApprovedCall } from '@/features/bots/lib/approval-event';

/**
 * An approved call while it runs (`25-bots.md` §5): "Running: Archive 25
 * threads…" with its clock, under the bot's "on it", until the turn that
 * reports it lands.
 */
export function ApprovedCallLive({ call }: { call: RunningApprovedCall }) {
  const { t } = useTranslation();
  return (
    <TraceLive elapsed={<BotTurnClock since={call.since} />}>
      {t('bots.chat.event.running', { summary: call.summary })}
    </TraceLive>
  );
}

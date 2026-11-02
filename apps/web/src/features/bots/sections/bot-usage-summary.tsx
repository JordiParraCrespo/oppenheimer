import { useBotRoomLeft, useSuspenseBotUsage } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotUsageReport } from '@/features/bots/components/bot-usage-report';

/**
 * The `/usage` card's figures (`25-bots.md` §4.1): what the chat spent, read
 * under Suspense, beside the room it has left, read off the chat it already
 * holds. A refetch that fails keeps the figures it has and says so above
 * them.
 */
export function BotUsageSummary({ botId, onClose }: { botId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: usage, error } = useSuspenseBotUsage(botId);
  const { context, planLimits } = useBotRoomLeft(botId);
  return (
    <>
      <ErrorAlert error={error} fallback={t('bots.chat.usage.loadFailed')} />
      <BotUsageReport
        usage={usage}
        context={context}
        fiveHour={planLimits?.fiveHour ?? null}
        sevenDay={planLimits?.sevenDay ?? null}
        onClose={onClose}
      />
    </>
  );
}

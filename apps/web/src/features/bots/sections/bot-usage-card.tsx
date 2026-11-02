import { Button, Card } from '@oppenheimer/design-system-web';
import { ErrorAlert, QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotUsageSkeleton } from '@/features/bots/components/bot-usage-skeleton';
import { useUsageCard } from '@/features/bots/hooks/use-usage-card';
import { closeUsageCard } from '@/features/bots/lib/usage-cards';
import { BotUsageSummary } from './bot-usage-summary';

/**
 * `/usage` (`25-bots.md` §4.1, "Built-in commands"), in the chat below its
 * last message, as Claude Code draws it: the bot is sent nothing, and the
 * card stays until it is closed. The figures read under Suspense; this draws
 * the card, their placeholder and a first failure.
 */
export function BotUsageCard({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const open = useUsageCard(botId);
  if (!open) return null;
  return (
    <Card padded className="mt-6">
      <QueryState>
        <QueryState.Pending>
          <BotUsageSkeleton />
        </QueryState.Pending>
        <QueryState.Error>
          {(error, retry) => (
            <ErrorAlert
              error={error}
              fallback={t('bots.chat.usage.loadFailed')}
              action={
                <Button variant="ghost" size="sm" onClick={retry}>
                  {t('common.retry')}
                </Button>
              }
              onDismiss={() => closeUsageCard(botId)}
            />
          )}
        </QueryState.Error>
        <QueryState.Data>
          <BotUsageSummary botId={botId} onClose={() => closeUsageCard(botId)} />
        </QueryState.Data>
      </QueryState>
    </Card>
  );
}

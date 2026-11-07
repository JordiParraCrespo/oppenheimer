import { Button, Card, ChatTranscript, ChatUserMessage } from '@oppenheimer/design-system-web';
import { ErrorAlert, QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotUsageSkeleton } from '@/features/bots/components/bot-usage-skeleton';
import { useUsageCard } from '@/features/bots/hooks/use-usage-card';
import { closeUsageCard } from '@/features/bots/lib/usage-cards';
import { BotUsageSummary } from './bot-usage-summary';

/**
 * `/usage` (`25-bots.md` §4.1, "Built-in commands"), in the chat below its
 * last message, as Claude Code draws it: the command as you sent it, and the
 * small card that answers it. The bot is sent nothing, and both stay until
 * the card is closed. The figures read under Suspense; this draws the card,
 * their placeholder and a first failure.
 */
export function BotUsageCard({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const open = useUsageCard(botId);
  if (!open) return null;
  return (
    // The chat's own column, so the card lines up with its messages and the composer.
    <ChatTranscript className="mt-5">
      <ChatUserMessage>/usage</ChatUserMessage>
      <Card className="w-full max-w-sm px-4 py-3">
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
    </ChatTranscript>
  );
}

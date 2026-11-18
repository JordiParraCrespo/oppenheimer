import { Button } from '@oppenheimer/design-system-web';
import { ErrorAlert, QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotTranscriptSkeleton } from '@/features/bots/components/bot-transcript-skeleton';
import { BotSideChatBody } from './bot-side-chat-body';

/**
 * A bot's chat in a session's side pane: pick a bot beside the work and talk
 * to it without leaving the session. The route composes it into the
 * sessions feature's pane; this draws the transcript's shape until the bot
 * answers, and the failure if the first read does not land.
 */
export function BotSideChat({ botId }: { botId: string }) {
  const { t } = useTranslation();

  return (
    <QueryState>
      <QueryState.Pending>
        <div aria-busy className="min-h-0 flex-1 overflow-hidden px-4 pt-6">
          <BotTranscriptSkeleton />
        </div>
      </QueryState.Pending>
      <QueryState.Error>
        {(error, retry) => (
          <ErrorAlert
            error={error}
            fallback={t('bots.chat.loadFailed')}
            className="m-4"
            action={
              <Button variant="ghost" size="sm" onClick={retry}>
                {t('common.retry')}
              </Button>
            }
          />
        )}
      </QueryState.Error>
      <QueryState.Data>
        <BotSideChatBody botId={botId} />
      </QueryState.Data>
    </QueryState>
  );
}

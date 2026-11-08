import { Button } from '@oppenheimer/design-system-web';
import { ErrorAlert, PageBar, QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotChatSkeleton } from '@/features/bots/components/bot-chat-skeleton';
import { BotChat } from '@/features/bots/sections/bot-chat';

/**
 * `/bots/$botId`: one bot's chat, the whole pane. The section reads the bot;
 * this draws the chat's shape until it can and the failure (a bot that is
 * gone, a request that did not land) if the first read fails. The route
 * draws its own bar (`bar: 'own'`), so each state here keeps one, the
 * sidebar toggle in it.
 */
export function BotChatScreen({ botId }: { botId: string }) {
  const { t } = useTranslation();

  return (
    <QueryState>
      <QueryState.Pending>
        <BotChatSkeleton />
      </QueryState.Pending>
      <QueryState.Error>
        {(error, retry) => (
          <>
            <PageBar title={null} />
            <ErrorAlert
              error={error}
              fallback={t('bots.chat.loadFailed')}
              className="m-6"
              action={
                <Button variant="ghost" size="sm" onClick={retry}>
                  {t('common.retry')}
                </Button>
              }
            />
          </>
        )}
      </QueryState.Error>
      <QueryState.Data>
        <BotChat botId={botId} />
      </QueryState.Data>
    </QueryState>
  );
}

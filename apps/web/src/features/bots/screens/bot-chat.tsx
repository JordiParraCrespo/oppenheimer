import { Button } from '@oppenheimer/design-system-web';
import { ErrorAlert, PageBar, QueryState } from '@oppenheimer/frontend-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BotChatSkeleton } from '@/features/bots/components/bot-chat-skeleton';
import { BotChat } from '@/features/bots/sections/bot-chat';

/**
 * `/bots/$botId`: one bot's chat, the whole pane. The section reads the bot;
 * this draws the chat's shape until it can and the failure (a bot that is
 * gone, a request that did not land) if the first read fails. The route
 * draws its own bar (`bar: 'own'`), so each state here keeps one, the
 * sidebar toggle in it. The pane is the console's recessed grey, the
 * chat's own wash, so its code, tables and inline code take the card there.
 *
 * With `tabs` (inside Sessions, from the route) every state's bar is the
 * open tabs, the bot's own among them, in place of its face and name.
 */
export function BotChatScreen({ botId, tabs }: { botId: string; tabs?: ReactNode }) {
  const { t } = useTranslation();

  return (
    <div className="contents [--chat-wash:var(--card)]">
      <QueryState>
        <QueryState.Pending>
          <BotChatSkeleton tabs={tabs} />
        </QueryState.Pending>
        <QueryState.Error>
          {(error, retry) => (
            <>
              <PageBar title={tabs ?? null} tone={tabs ? 'chrome' : 'page'} />
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
          <BotChat botId={botId} tabs={tabs} />
        </QueryState.Data>
      </QueryState>
    </div>
  );
}

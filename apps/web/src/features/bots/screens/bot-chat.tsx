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
 * sidebar toggle in it. The pane stands on a session chat's ground
 * (`--chat-ground`, the terminal's), so a bot and a session read as one
 * surface, and its code, tables and inline code take the chat's own wash.
 *
 * With `tabs` (inside Sessions, from the route) every state's bar is the
 * open tabs, the bot's own among them, in place of its face and name.
 */
export function BotChatScreen({ botId, tabs }: { botId: string; tabs?: ReactNode }) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-chat-ground">
      <QueryState>
        <QueryState.Pending>
          <BotChatSkeleton tabs={tabs} />
        </QueryState.Pending>
        <QueryState.Error>
          {(error, retry) => (
            <>
              <PageBar
                title={tabs ?? null}
                tone={tabs ? 'chrome' : 'page'}
                className={tabs ? undefined : 'border-b border-border-subtle bg-term-bg'}
              />
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

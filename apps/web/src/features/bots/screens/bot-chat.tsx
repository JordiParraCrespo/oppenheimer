import { Skeleton } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotChat } from '@/features/bots/sections/bot-chat';

/**
 * `/bots/$botId`: one bot's chat, the whole pane. The section reads the bot;
 * this draws its header's place until it can, and the failure (a bot that is
 * gone, a request that did not land) if the first read fails.
 */
export function BotChatScreen({ botId }: { botId: string }) {
  const { t } = useTranslation();

  return (
    <QueryState>
      <QueryState.Pending>
        <div className="flex h-12 items-center gap-2.5 px-3.5">
          <Skeleton shape="pill" className="size-6.5" />
          <Skeleton className="h-4 w-32" />
        </div>
      </QueryState.Pending>
      <QueryState.Error fallback={t('bots.chat.loadFailed')} className="m-6" />
      <QueryState.Data>
        <BotChat botId={botId} />
      </QueryState.Data>
    </QueryState>
  );
}

import { useFeatureFlag } from '@oppenheimer/frontend-core/react';
import { Navigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { BotChatSlotContext } from '@/features/inbox/hooks/use-bot-chat-slot';
import { useInboxSearch } from '@/features/inbox/hooks/use-inbox-search';
import { useForgetVisitOnLeave } from '@/features/inbox/hooks/use-inbox-visit';
import { InboxListColumn } from '@/features/inbox/sections/inbox-list-column';
import { InboxReader } from '@/features/inbox/sections/inbox-reader';

/**
 * The Inbox, a page of its own and where the console opens: the list column
 * and the deck side by side in the pane, as a mail client, the list only on
 * a phone until an item is opened. Behind the `inbox` flag: switched off,
 * the address goes on to New session, where the console opened before.
 * `botChat` is a bot's chat as the route composes it, for a bot's notice to
 * open in place and be answered there.
 */
export function InboxScreen({ botChat }: { botChat?: (botId: string) => ReactNode }) {
  const enabled = useFeatureFlag('inbox');
  const { item } = useInboxSearch();
  useForgetVisitOnLeave();

  if (!enabled) return <Navigate to="/sessions/new" replace />;
  return (
    <BotChatSlotContext value={botChat ?? null}>
      <div className="flex min-h-0 flex-1">
        <InboxListColumn reading={item !== null} />
        <InboxReader reading={item !== null} />
      </div>
    </BotChatSlotContext>
  );
}

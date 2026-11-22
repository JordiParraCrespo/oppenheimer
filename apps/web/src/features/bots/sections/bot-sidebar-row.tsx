import { SortableBotPreviewItem } from '@oppenheimer/design-system-web';
import type { BotEntity, BotGroupEntity } from '@oppenheimer/frontend-consumer';
import { useUpdateBot } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BotRowMenu } from '@/features/bots/components/bot-row-menu';
import { BotRowTime } from '@/features/bots/components/bot-row-time';
import { DeleteBotDialog } from '@/features/bots/dialogs/delete-bot';
import { useBotPin } from '@/features/bots/hooks/use-bot-pins';
import { useBotRowItem } from '@/features/bots/hooks/use-bot-row-item';
import { useBotUnread } from '@/features/bots/hooks/use-bot-unread';

/**
 * One bot in the Employees sidebar, the way a messaging app's chat list
 * reads: its face on its colour, the name with when it was last active, and
 * under it its last message (its description before the first), its
 * markdown read rather than shown. A section because it
 * subscribes to the route (lit on its chat and on its settings), owns the
 * move, and keeps the delete dialog open past the menu that asked for it.
 * `groups` are the Move pane's targets; its pin is the sidebar's
 * (`BotPinsContext`), which draws a pinned row under Pinned; `onHide`
 * takes it out of the sidebar. The row drags by
 * itself (a click still opens the chat) unless `dragDisabled`.
 */
export function BotSidebarRow({
  bot,
  groups,
  dragDisabled,
  onHide,
}: {
  bot: BotEntity;
  groups: readonly BotGroupEntity[];
  dragDisabled: boolean;
  onHide: (id: string) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const active = useRouterState({
    select: (state) =>
      state.location.pathname === `/bots/${bot.id}` ||
      state.location.pathname.startsWith(`/bots/${bot.id}/`),
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const move = useUpdateBot();
  const pin = useBotPin(bot.id);
  const mark = useBotUnread(bot.id);
  const item = useBotRowItem(bot);

  return (
    <>
      <SortableBotPreviewItem
        {...item}
        time={<BotRowTime at={bot.lastActivityAt} />}
        disabled={dragDisabled}
        active={active}
        menuOpen={menuOpen}
        render={<Link to="/bots/$botId" params={{ botId: bot.id }} />}
        action={
          <BotRowMenu
            open={menuOpen}
            onOpenChange={setMenuOpen}
            groups={groups}
            groupId={bot.groupId}
            pinned={pin.pinned}
            onPinChange={pin.setPinned}
            unread={mark.unread}
            onUnreadChange={mark.setUnread}
            onSettings={() =>
              navigate({ to: '/bots/$botId/settings/profile', params: { botId: bot.id } })
            }
            onMove={(groupId) => move.mutate({ id: bot.id, input: { groupId } })}
            onHide={() => onHide(bot.id)}
            onDelete={() => setDeleting(true)}
          />
        }
      />
      <ErrorAlert
        error={move.error}
        fallback={t('bots.sidebar.moveFailed')}
        onDismiss={() => move.reset()}
        className="mx-1.5 my-1"
      />
      {deleting ? <DeleteBotDialog bot={bot} onClose={() => setDeleting(false)} /> : null}
    </>
  );
}

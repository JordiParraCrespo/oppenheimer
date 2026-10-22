import { SortableBotItem } from '@oppenheimer/design-system-web';
import type { BotEntity, BotGroupEntity } from '@oppenheimer/frontend-consumer';
import { useUpdateBot } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatAge } from '@oppenheimer/frontend-web';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BotRowMenu } from '@/features/bots/components/bot-row-menu';
import { DeleteBotDialog } from '@/features/bots/dialogs/delete-bot';

/**
 * One bot in the Employees sidebar: its initials on its colour, the name, how
 * long since it last changed, and its last message as the preview line (its
 * description before the first). A section because it subscribes to the
 * route (lit on its chat and on its settings), owns the move, and keeps the
 * delete dialog open past the menu that asked for it. `now` is its group's
 * minute clock; `groups` are the Move pane's targets. The row drags by
 * itself (a click still opens the chat) unless `dragDisabled`.
 */
export function BotSidebarRow({
  bot,
  groups,
  now,
  dragDisabled,
}: {
  bot: BotEntity;
  groups: readonly BotGroupEntity[];
  now: number;
  dragDisabled: boolean;
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

  return (
    <>
      <SortableBotItem
        id={bot.id}
        disabled={dragDisabled}
        name={bot.name}
        initials={bot.initials}
        color={bot.avatarColor}
        age={formatAge(bot.lastActivityAt, now, t)}
        preview={bot.lastMessagePreview || bot.description || t('bots.sidebar.noMessages')}
        active={active}
        menuOpen={menuOpen}
        render={<Link to="/bots/$botId" params={{ botId: bot.id }} />}
        action={
          <BotRowMenu
            open={menuOpen}
            onOpenChange={setMenuOpen}
            groups={groups}
            groupId={bot.groupId}
            onSettings={() =>
              navigate({ to: '/bots/$botId/settings/profile', params: { botId: bot.id } })
            }
            onMove={(groupId) => move.mutate({ id: bot.id, input: { groupId } })}
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

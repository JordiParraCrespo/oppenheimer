import { SortableBotItem, useRowMenu } from '@oppenheimer/design-system-web';
import type { BotEntity } from '@oppenheimer/frontend-consumer';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionBotRowMenu } from '@/features/bots/components/section-bot-row-menu';
import { DeleteBotDialog } from '@/features/bots/dialogs/delete-bot';
import { useBotRowItem } from '@/features/bots/hooks/use-bot-row-item';
import { useBotUnread } from '@/features/bots/hooks/use-bot-unread';
import { botChatDestination } from '@/features/bots/lib/bot-chat-destination';
import { SECTION_NAMES } from '@/features/bots/lib/section-names';

/**
 * One bot under a section's Bots heading, drawn as in Employees: its
 * face on its colour and the name on one line, its last message in the
 * row's tooltip, opening its chat where the section opens one
 * (`botChatDestination`). Its ellipsis opens
 * Settings, hides it from this section (`onHide`, the heading's write) or
 * deletes it for good, behind the same confirmation as in Employees. A
 * section because it subscribes to the route, to light up on its own chat.
 * The row drags by itself (a click still opens the chat) on its heading's
 * drag layer. A right-click opens the row's menu at its ellipsis.
 */
export function SectionBotRow({
  bot,
  section,
  onHide,
}: {
  bot: BotEntity;
  section: BotSection;
  onHide: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { to, params, path } = botChatDestination(section, bot.id);
  const active = useRouterState({ select: (state) => state.location.pathname === path });
  const menu = useRowMenu();
  const [deleting, setDeleting] = useState(false);
  const item = useBotRowItem(bot);
  const mark = useBotUnread(bot.id);

  return (
    <>
      <SortableBotItem
        {...item}
        active={active}
        menuOpen={menu.open}
        onContextMenu={menu.onContextMenu}
        render={<Link to={to} params={params} />}
        action={
          <SectionBotRowMenu
            open={menu.open}
            onOpenChange={menu.setOpen}
            where={t(SECTION_NAMES[section])}
            unread={mark.unread}
            onUnreadChange={mark.setUnread}
            onSettings={() =>
              navigate({ to: '/bots/$botId/settings/profile', params: { botId: bot.id } })
            }
            onHide={onHide}
            onDelete={() => setDeleting(true)}
          />
        }
      />
      {deleting ? <DeleteBotDialog bot={bot} onClose={() => setDeleting(false)} /> : null}
    </>
  );
}

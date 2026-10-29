import { BotItem } from '@oppenheimer/design-system-web';
import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { formatAge, MarkdownLine } from '@oppenheimer/frontend-web';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionBotRowMenu } from '@/features/bots/components/section-bot-row-menu';
import { DeleteBotDialog } from '@/features/bots/dialogs/delete-bot';
import { botChatDestination } from '@/features/bots/lib/bot-chat-destination';
import { SECTION_NAMES } from '@/features/bots/lib/section-names';

/**
 * One bot under a section's Bots heading, drawn as in Employees: its
 * initials on its colour, the name, its age and its last message, opening its
 * chat where the section opens one (`botChatDestination`). Its ellipsis opens
 * Settings, hides it from this section (`onHide`, the heading's write) or
 * deletes it for good, behind the same confirmation as in Employees. A
 * section because it subscribes to the route, to light up on its own chat.
 */
export function SectionBotRow({
  bot,
  section,
  now,
  onHide,
}: {
  bot: BotEntity;
  section: BotSection;
  now: number;
  onHide: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { to, params, path } = botChatDestination(section, bot.id);
  const active = useRouterState({ select: (state) => state.location.pathname === path });
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const line = bot.lastMessagePreview || bot.description;

  return (
    <>
      <BotItem
        name={bot.name}
        initials={bot.initials}
        color={bot.avatarColor}
        age={formatAge(bot.lastActivityAt, now, t)}
        preview={line ? <MarkdownLine source={line} /> : t('bots.sidebar.noMessages')}
        active={active}
        menuOpen={menuOpen}
        render={<Link to={to} params={params} />}
        action={
          <SectionBotRowMenu
            open={menuOpen}
            onOpenChange={setMenuOpen}
            where={t(SECTION_NAMES[section])}
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

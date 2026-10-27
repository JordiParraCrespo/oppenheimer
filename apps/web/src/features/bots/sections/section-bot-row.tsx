import { BotItem } from '@oppenheimer/design-system-web';
import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { formatAge, MarkdownLine } from '@oppenheimer/frontend-web';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { botChatDestination } from '@/features/bots/lib/bot-chat-destination';

/**
 * One bot under a section's Bots heading, drawn as in Employees: its
 * initials on its colour, the name, its age and its last message, opening its
 * chat where the section opens one (`botChatDestination`). A section because
 * it subscribes to the route, to light up on its own chat.
 */
export function SectionBotRow({
  bot,
  section,
  now,
}: {
  bot: BotEntity;
  section: BotSection;
  now: number;
}) {
  const { t } = useTranslation();
  const { to, params, path } = botChatDestination(section, bot.id);
  const active = useRouterState({ select: (state) => state.location.pathname === path });
  const line = bot.lastMessagePreview || bot.description;

  return (
    <BotItem
      name={bot.name}
      initials={bot.initials}
      color={bot.avatarColor}
      age={formatAge(bot.lastActivityAt, now, t)}
      preview={line ? <MarkdownLine source={line} /> : t('bots.sidebar.noMessages')}
      active={active}
      render={<Link to={to} params={params} />}
    />
  );
}

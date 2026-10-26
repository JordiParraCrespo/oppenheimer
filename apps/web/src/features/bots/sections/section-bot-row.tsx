import { BotItem } from '@oppenheimer/design-system-web';
import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { formatAge, MarkdownLine } from '@oppenheimer/frontend-web';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * One bot under a section's Bots heading, drawn as in Employees: its
 * initials on its colour, the name, its age and its last message. In Pull
 * requests its chat opens inside the section (`/pulls/bots/$botId`), as the
 * export draws it; elsewhere it opens in Employees. A section because it
 * subscribes to the route, to light up on its own chat.
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
  const inPulls = section === 'pulls';
  const active = useRouterState({
    select: (state) =>
      state.location.pathname === (inPulls ? `/pulls/bots/${bot.id}` : `/bots/${bot.id}`),
  });
  const line = bot.lastMessagePreview || bot.description;

  return (
    <BotItem
      name={bot.name}
      initials={bot.initials}
      color={bot.avatarColor}
      age={formatAge(bot.lastActivityAt, now, t)}
      preview={line ? <MarkdownLine source={line} /> : t('bots.sidebar.noMessages')}
      active={active}
      render={
        inPulls ? (
          <Link to="/pulls/bots/$botId" params={{ botId: bot.id }} />
        ) : (
          <Link to="/bots/$botId" params={{ botId: bot.id }} />
        )
      }
    />
  );
}

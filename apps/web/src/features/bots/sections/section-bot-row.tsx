import { BotItem } from '@oppenheimer/design-system-web';
import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { useUpdateBot } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatAge, MarkdownLine } from '@oppenheimer/frontend-web';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionBotRowMenu } from '@/features/bots/components/section-bot-row-menu';
import { botChatDestination } from '@/features/bots/lib/bot-chat-destination';
import { withPlacement } from '@/features/bots/lib/placement';
import { SECTION_NAMES } from '@/features/bots/lib/section-names';

/**
 * One bot under a section's Bots heading, drawn as in Employees: its
 * initials on its colour, the name, its age and its last message, opening its
 * chat where the section opens one (`botChatDestination`). Its ellipsis opens
 * Settings or hides it from this section. A section because it subscribes to
 * the route, to light up on its own chat, and owns the hide.
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
  const navigate = useNavigate();
  const { to, params, path } = botChatDestination(section, bot.id);
  const active = useRouterState({ select: (state) => state.location.pathname === path });
  const [menuOpen, setMenuOpen] = useState(false);
  const hide = useUpdateBot();
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
            onHide={() =>
              hide.mutate({
                id: bot.id,
                input: { sections: withPlacement(bot.sections, section, false) },
              })
            }
          />
        }
      />
      <ErrorAlert
        error={hide.error}
        fallback={t('bots.section.placeFailed')}
        onDismiss={() => hide.reset()}
        className="mx-1.5 my-1"
      />
    </>
  );
}

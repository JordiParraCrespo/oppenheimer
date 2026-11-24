import { BotFaceItem } from '@oppenheimer/design-system-web';
import type { BotEntity } from '@oppenheimer/frontend-consumer';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useBotRowItem } from '@/features/bots/hooks/use-bot-row-item';
import { botChatDestination } from '@/features/bots/lib/bot-chat-destination';

/**
 * One bot's face in a folded Bots heading: what its `SectionBotRow` would
 * show, on the face alone, opening the same chat. A section because it
 * subscribes to the route, to ring itself on its own chat.
 */
export function SectionBotFace({ bot, section }: { bot: BotEntity; section: BotSection }) {
  const { t } = useTranslation();
  const { to, params, path } = botChatDestination(section, bot.id);
  const active = useRouterState({ select: (state) => state.location.pathname === path });
  const item = useBotRowItem(bot);
  const label = item.needsInput
    ? t('bots.section.faceWaiting', { name: bot.name })
    : item.working
      ? t('bots.section.faceWorking', { name: bot.name })
      : item.unread
        ? t('bots.section.faceUnread', { name: bot.name })
        : bot.name;
  return (
    <BotFaceItem
      name={item.name}
      label={label}
      initials={item.initials}
      face={item.face}
      preview={item.preview}
      working={item.working}
      unread={item.unread}
      needsInput={item.needsInput}
      active={active}
      render={<Link to={to} params={params} />}
    />
  );
}

import { BotFaceItem } from '@oppenheimer/design-system-web';
import type { BotEntity } from '@oppenheimer/frontend-consumer';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useBotRowItem } from '@/features/bots/hooks/use-bot-row-item';
import { useSectionBotChat } from '@/features/bots/hooks/use-section-bot-chat';

const STATE_LABEL = {
  needsInput: 'bots.section.faceWaiting',
  working: 'bots.section.faceWorking',
  unread: 'bots.section.faceUnread',
} as const;

/**
 * One bot's face in a folded Bots heading: what its `SectionBotRow` would
 * show, on the face alone, opening the same chat and lit by the same
 * decision (`useSectionBotChat`). Its label says the state the row's hook
 * picked. A section because it subscribes to the route.
 */
export function SectionBotFace({ bot, section }: { bot: BotEntity; section: BotSection }) {
  const { t } = useTranslation();
  const { to, params, active } = useSectionBotChat(section, bot.id);
  const item = useBotRowItem(bot);
  return (
    <BotFaceItem
      name={item.name}
      label={item.state ? t(STATE_LABEL[item.state], { name: bot.name }) : bot.name}
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

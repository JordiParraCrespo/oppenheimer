import { BotAvatar, ChatTab } from '@oppenheimer/design-system-web';
import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useBotRowItem } from '@/features/bots/hooks/use-bot-row-item';

/**
 * A bot's tab over Sessions: its face, its name and its close, with the
 * state its sidebar row draws (amber while it waits on you, the name's
 * shimmer while it works, blue for a reply not read). It opens the chat
 * inside Sessions, where the tabs are.
 */
export function BotTab({
  bot,
  active,
  onClose,
}: {
  bot: BotEntity;
  active: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const item = useBotRowItem(bot);
  const attention = item.needsInput ? 'needs-you' : item.unread ? 'unread' : undefined;

  return (
    <ChatTab
      active={active}
      icon={<BotAvatar option={{ initials: bot.initials }} size={16} face={bot.face} />}
      attention={attention}
      working={item.working}
      title={bot.name}
      render={<Link to="/sessions/bots/$botId" params={{ botId: bot.id }} />}
      onClose={onClose}
      closeLabel={t('sessions.tabs.close', { name: bot.name })}
    >
      {bot.name}
    </ChatTab>
  );
}

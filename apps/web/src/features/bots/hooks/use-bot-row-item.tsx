import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { useBotNeedsInput, useBotWorking } from '@oppenheimer/frontend-consumer/react';
import { MarkdownLine } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { isBotDone } from '../lib/bot-seen';
import { useBotSeenAt } from './use-bot-seen';

/**
 * What every sidebar row of a bot draws, wherever it is listed (Employees, a
 * section's Bots): its name and face, its last message (its description
 * before the first) in the tooltip, its markdown read rather than shown, and
 * the amber dot while it waits on the person, the green dot and a
 * shimmering name while a turn of its is queued or running, and the blue dot
 * once it is done with something the reader has not seen in its chat on this
 * device, as a session ready for review has. The rows add their own route,
 * menu and drag.
 */
export function useBotRowItem(bot: BotEntity) {
  const { t } = useTranslation();
  const needsInput = useBotNeedsInput(bot.id);
  const live = useBotWorking(bot.id);
  const seenAt = useBotSeenAt(bot.id);
  const line = bot.lastMessagePreview || bot.description;
  return {
    id: bot.id,
    name: bot.name,
    initials: bot.initials,
    face: bot.face,
    preview: line ? <MarkdownLine source={line} /> : t('bots.sidebar.noMessages'),
    needsInput,
    live,
    unread: isBotDone(bot, live, seenAt),
  };
}

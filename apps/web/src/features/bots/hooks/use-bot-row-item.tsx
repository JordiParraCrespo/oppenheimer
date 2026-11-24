import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { useBotWaitingOnYou, useBotWorking } from '@oppenheimer/frontend-consumer/react';
import { MarkdownLine } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { useBotUnread } from './use-bot-unread';

/**
 * What every sidebar row of a bot draws, wherever it is listed (Employees, a
 * section's Bots), the way a session's row reads: its name and face, its last
 * message (its description before the first) in the tooltip, its markdown
 * read rather than shown; then one state, first match wins. Waiting on you
 * (a card pending, a turn failed since you read the chat) is the amber dot;
 * working (a turn queued or running) shimmers the name; done with a message
 * you have not read, or marked unread on this device, is the blue dot. The
 * rows add their own route, menu and drag. `state` names the winner, for a
 * surface that says it in words (a face's label).
 */
/** The one state a bot's row shows, first match wins; null shows none. */
export type BotRowState = 'needsInput' | 'working' | 'unread' | null;

export function useBotRowItem(bot: BotEntity) {
  const { t } = useTranslation();
  const waiting = useBotWaitingOnYou(bot.id);
  const working = useBotWorking(bot.id);
  const marked = useBotUnread(bot.id).unread;
  const line = bot.lastMessagePreview || bot.description;
  const state: BotRowState = waiting
    ? 'needsInput'
    : working
      ? 'working'
      : bot.unread || marked
        ? 'unread'
        : null;
  return {
    id: bot.id,
    name: bot.name,
    initials: bot.initials,
    face: bot.face,
    preview: line ? <MarkdownLine source={line} /> : t('bots.sidebar.noMessages'),
    state,
    needsInput: waiting,
    working: !waiting && working,
    unread: !waiting && ((!working && bot.unread) || marked),
  };
}

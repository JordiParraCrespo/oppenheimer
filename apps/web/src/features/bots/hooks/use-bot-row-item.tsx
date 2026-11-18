import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { useBotNeedsInput } from '@oppenheimer/frontend-consumer/react';
import { MarkdownLine } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * What every sidebar row of a bot draws, wherever it is listed (Employees, a
 * section's Bots): its name and face, its last message (its description
 * before the first) in the tooltip, its markdown read rather than shown, and
 * the amber dot while it waits on the person. The rows add their own route,
 * menu and drag.
 */
export function useBotRowItem(bot: BotEntity) {
  const { t } = useTranslation();
  const needsInput = useBotNeedsInput(bot.id);
  const line = bot.lastMessagePreview || bot.description;
  return {
    id: bot.id,
    name: bot.name,
    initials: bot.initials,
    face: bot.face,
    preview: line ? <MarkdownLine source={line} /> : t('bots.sidebar.noMessages'),
    needsInput,
  };
}

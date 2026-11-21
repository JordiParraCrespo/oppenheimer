import { useBotSlashCommands } from '@oppenheimer/frontend-consumer/react';
import { useCommandMenu } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { pickedDraft, slashMenuRows, slashQuery } from '@/features/bots/lib/slash-menu';

/**
 * The composer's `/` menu (OpenClaw's skill commands and Claude Code's
 * built-ins): while the draft is a command being typed, the rows
 * `slashMenuRows` decides for what is typed, the bot's skills read only
 * while one is. The keyboard is the kit's `useCommandMenu`; a pick makes the
 * draft `/<name> `.
 */
export function useSlashMenu(botId: string, draft: string, setDraft: (next: string) => void) {
  const { t } = useTranslation();
  const query = slashQuery(draft);
  const { data: skills } = useBotSlashCommands(botId, query !== null);
  return useCommandMenu({
    draft,
    query,
    rowsFor: (typed) => slashMenuRows(typed, skills, (key) => t(key)),
    onPick: (command) => setDraft(pickedDraft(command)),
  });
}

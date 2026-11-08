import { useBotSlashCommands } from '@oppenheimer/frontend-consumer/react';
import type { KeyboardEvent } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  pickedDraft,
  type SlashCommand,
  slashMenuRows,
  slashQuery,
} from '@/features/bots/lib/slash-menu';

/**
 * The composer's `/` menu (`25-bots.md` §4.1, OpenClaw's skill commands and
 * Claude Code's built-ins): while the draft is a command being typed, the
 * rows `slashMenuRows` decides for what is typed, the bot's skills read only
 * while it is open. Up and Down move through them, Tab
 * or Enter picks one (the draft becomes `/<name> `), Escape closes the menu
 * for that draft. The highlight belongs to what was typed, so a new letter
 * starts it at the top again with no effect to reset it.
 */
export function useSlashMenu(botId: string, draft: string, setDraft: (next: string) => void) {
  const { t } = useTranslation();
  const query = slashQuery(draft);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<{ query: string; index: number } | null>(null);
  const wanted = query !== null && dismissed !== draft;
  const { data: skills } = useBotSlashCommands(botId, wanted);
  const groups =
    wanted && query !== null
      ? slashMenuRows(query, skills, (key) => t(key))
      : { builtIns: [], skills: [] };
  const items = [...groups.builtIns, ...groups.skills];
  const open = items.length > 0;
  const index =
    highlight && highlight.query === query ? Math.min(highlight.index, items.length - 1) : 0;

  function pick(command: SlashCommand) {
    setDraft(pickedDraft(command));
  }

  function onKeyDownCapture(event: KeyboardEvent<HTMLDivElement>) {
    if (!open || query === null) return;
    const move = (by: number) =>
      setHighlight({ query, index: (index + by + items.length) % items.length });
    const handled: Record<string, () => void> = {
      ArrowDown: () => move(1),
      ArrowUp: () => move(-1),
      Tab: () => items[index] && pick(items[index]),
      Enter: () => items[index] && pick(items[index]),
      Escape: () => setDismissed(draft),
    };
    const action = event.shiftKey ? undefined : handled[event.key];
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    action();
  }

  return { open, groups, highlighted: index, pick, onKeyDownCapture };
}

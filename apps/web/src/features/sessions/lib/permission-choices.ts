import type { ChatPermissionPrompt } from '@oppenheimer/frontend-consumer';
import type { PermissionChoiceKind } from '@oppenheimer/shared/sessions';

/** One row of the permission card: the dialog's option it picks, and how the card words it. */
export interface PermissionChoice {
  /** The option's index in the agent's dialog, which its keys pick. */
  option: number;
  kind: PermissionChoiceKind;
  /** The agent's own words for it, without the yes or no they open with; none when the card's label says it all. */
  words: string | null;
}

/** Sentence case for words cut out of the agent's label. */
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The rows the card offers for a dialog: allowing first, then refusing,
 * each in the agent's order, and never a switch of the whole session's mode
 * (`mode`), which stays the terminal's to make. An "always" row keeps what
 * the agent says it would stop asking about ("Don't ask again for mkdir
 * commands in …"), so the person allows exactly what the agent offers.
 */
export function permissionChoices(prompt: ChatPermissionPrompt): PermissionChoice[] {
  const rank: Record<PermissionChoiceKind, number> = {
    once: 0,
    always: 1,
    decline: 2,
    deny: 3,
    mode: 4,
  };
  return prompt.options
    .filter((option) => option.kind !== null && option.kind !== 'mode')
    .map((option) => {
      const kind = option.kind ?? 'mode';
      const rest = option.label.replace(/^(?:Yes|No),?\s*(?:and\s+)?/i, '').trim();
      return {
        option: option.index,
        kind,
        words: kind === 'always' || kind === 'decline' ? capital(rest) || null : null,
      };
    })
    .sort((a, b) => rank[a.kind] - rank[b.kind] || a.option - b.option);
}

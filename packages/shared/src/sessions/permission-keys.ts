import type { CodingAgentId } from '../agents/catalog.js';

/**
 * The permission dialog an agent draws before a tool runs ("Do you want to
 * proceed?"), as data per agent: how its question reads, what each of its
 * options does, and the keys that answer it the way a person would at the
 * terminal. The console reads the dialog off the screen with this
 * (`readPermissionPrompt` in the consumer package) and types the keys the
 * person's pick comes to (`permissionChoiceKeys`). An agent with no entry
 * draws no dialog the console answers: its chat says it waits, as before.
 */

/**
 * What an option does: run the tool this once; run it and stop asking for
 * its kind; refuse it and stop the turn; refuse it and let the agent go on
 * (`decline`); or switch a mode for the whole session (`mode`), which the
 * card leaves to the terminal.
 */
export type PermissionChoiceKind = 'once' | 'always' | 'deny' | 'decline' | 'mode';

/** One option the dialog may offer, told by its label. */
export interface PermissionChoiceRule {
  kind: PermissionChoiceKind;
  label: RegExp;
  /** The key bound to it, for an agent that binds letters; none picks it by its number. */
  key?: string;
}

/** How one agent's permission dialog reads and is answered. */
export interface PermissionPromptSpec {
  /** Its question, the line right over the options. */
  titles: readonly RegExp[];
  /** Its options, the first rule that matches a label telling what it does. */
  choices: readonly PermissionChoiceRule[];
  /**
   * The words its footer says when the option under the cursor takes a note
   * of the person's own (`Tab to amend`), and the key that opens it; none
   * when it never does. Without it, a note follows a refusal as the next
   * message.
   */
  amend: { hint: RegExp; key: string } | null;
  /**
   * Where it says what it asks about: over its question, up to the rule
   * across the screen (Claude Code), or between its question and its
   * options (Codex).
   */
  detailAt: 'above' | 'below';
  /** Lines in that place that say nothing about the call (a tip). */
  noise?: RegExp;
}

const TAB = '\t';
const ENTER = '\r';
const DOWN = '\u001b[B';
const UP = '\u001b[A';

/**
 * Claude Code 2.1.331, watched in tmux (default permission mode, a Bash
 * command, an Edit, a Write, a WebFetch). Its dialog is a numbered list, the
 * cursor (`❯`) on 1 as it opens; a digit picks its option and sends it at
 * once. A Bash command offers `1. Yes`, `2. Yes, and don't ask again for
 * <rule> in <dir>`, `3. Yes, and switch to auto mode · …`, `4. No`; an edit
 * or a write `1. Yes`, `2. Yes, and switch to accept edits (…) for this
 * session (shift+tab)`, `3. No`; a fetch `1. Yes`, `2. Yes, and don't ask
 * again for <domain>`, `3. No, and tell Claude what to do differently (esc)`.
 * Where the footer says `Esc to cancel · Tab to amend`, Tab on the option
 * under the cursor turns it into a field (`No, and tell Claude what to do
 * differently`, `Yes, and tell Claude what to do next`): the words, then
 * Enter, send the choice with them. Esc refuses and stops the turn.
 */
const CLAUDE_CODE: PermissionPromptSpec = {
  titles: [/^Do you want to\b.*\?$/],
  choices: [
    { kind: 'once', label: /^Yes(?:, and tell Claude what to do next)?$/ },
    { kind: 'mode', label: /^Yes, and switch to auto mode\b/ },
    { kind: 'always', label: /^Yes, (?:and )?(?:don['’]t ask again|allow all|always allow)\b/ },
    { kind: 'always', label: /^Yes, and switch to accept edits\b/ },
    { kind: 'deny', label: /^No\b/ },
  ],
  amend: { hint: /\bTab to amend\b/, key: TAB },
  detailAt: 'above',
  noise: /^Tip:/,
};

/**
 * Codex 0.172.0, read off its TUI's source (`bottom_pane/approval_overlay.rs`
 * and the approval keymap's defaults in `keymap.rs`), not yet watched live:
 * each option is bound to a letter that answers at once — `y` Yes, proceed;
 * `a` for this command (these files, this host) for the session; `p` for
 * commands that start with a prefix, or a host from now on; `d` No, continue
 * without running it (or block the host); `n` (and Esc) No, and tell Codex
 * what to do differently, which ends the turn. It takes no note in the
 * dialog.
 */
const CODEX: PermissionPromptSpec = {
  titles: [
    /^Would you like to (?:run the following command|make the following edits|grant these permissions)\?$/,
    /^Do you want to approve network access to\b.*\?$/,
  ],
  choices: [
    { kind: 'once', label: /^Yes, (?:proceed|just this once)\b/, key: 'y' },
    {
      kind: 'always',
      label: /^Yes, and don['’]t ask again for commands that start with\b/,
      key: 'p',
    },
    { kind: 'always', label: /^Yes, and allow this host in the future\b/, key: 'p' },
    { kind: 'always', label: /^Yes, and (?:don['’]t ask again|allow)\b/, key: 'a' },
    {
      kind: 'decline',
      label: /^No, (?:continue without running it|and block this host)\b/,
      key: 'd',
    },
    { kind: 'deny', label: /^No, and tell Codex what to do differently\b/, key: 'n' },
  ],
  amend: null,
  detailAt: 'below',
};

const PERMISSION_PROMPTS: Partial<Record<CodingAgentId, PermissionPromptSpec>> = {
  'claude-code': CLAUDE_CODE,
  codex: CODEX,
};

/** How `agent`'s permission dialog reads, or undefined for one the console does not answer. */
export function permissionPromptOf(agent: string): PermissionPromptSpec | undefined {
  return Object.hasOwn(PERMISSION_PROMPTS, agent)
    ? PERMISSION_PROMPTS[agent as CodingAgentId]
    : undefined;
}

/** What one option of a dialog on screen is: its label, what it does, its number and its key. */
export interface PermissionOption {
  label: string;
  kind: PermissionChoiceKind | null;
  /** Its place in the dialog, from 0, in screen order. */
  index: number;
  /** The key bound to it, or none to pick it by its number. */
  key: string | null;
}

/** What the keys depend on: the options, where the cursor is, and whether a note opens in place. */
export interface KeyedPermission {
  options: readonly PermissionOption[];
  /** The option under the cursor, from 0. */
  cursor: number;
  /** The key that opens a note on the option under the cursor; none when the dialog takes none. */
  amendKey: string | null;
}

/** The gap between the keys of one answer: the dialog redraws after each. */
export const PERMISSION_KEY_GAP_MS = 120;

/**
 * The keys that pick `choice` (an option's index) on a dialog on screen, one
 * write each. A bound letter, or the option's number. With a note and a
 * dialog that takes one in place: the arrows to the option from the cursor,
 * the key that opens its field, the words on one line, Enter. A note the
 * dialog cannot take is the caller's to send as the next message, once the
 * refusal has landed.
 */
export function permissionChoiceKeys(
  dialog: KeyedPermission,
  choice: number,
  note: string | null = null,
): string[] {
  const option = dialog.options.find((candidate) => candidate.index === choice);
  if (!option) return [];
  const words = note?.replace(/\s*\n\s*/g, ' ').trim() || null;
  if (words && dialog.amendKey) {
    const steps = choice - dialog.cursor;
    const arrows = Array<string>(Math.abs(steps)).fill(steps > 0 ? DOWN : UP);
    return [...arrows, dialog.amendKey, words, ENTER];
  }
  return [option.key ?? String(option.index + 1)];
}

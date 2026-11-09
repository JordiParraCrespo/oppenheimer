import {
  BOT_BUILT_IN_COMMANDS,
  BOT_SKILL_BODY_MAX,
  BOT_SKILL_RESERVED_NAMES,
  type BotAuthor,
} from '@oppenheimer/shared';

/**
 * How a bot learns from its own work (`25-bots.md` §4.1, 2026-11-09, from
 * Hermes Agent's learning loop): it saves the way it did a hard task as a
 * skill without being asked, and fixes a skill it followed that turned out
 * wrong or stale.
 */

/**
 * After this many of a turn's tool calls, with no skill used or saved, the
 * bot is reminded once to save how it did the work. A turn takes at most 20
 * steps (`BOT_TURN_MAX_STEPS`); 8 is work, not a lookup.
 */
export const BOT_SKILL_NUDGE_AFTER_STEPS = 8;

/** The tools that mean the turn already reached for a skill. */
const SKILL_TOOLS: ReadonlySet<string> = new Set(['use_skill', 'save_skill', 'patch_skill']);

/**
 * The reminder, as the model reads it after a tool's result. One line,
 * the same bytes every time, so the transcript can take it back off.
 */
export const SKILL_NUDGE = `\n\n<reminder>You have made ${BOT_SKILL_NUDGE_AFTER_STEPS} tool calls in this turn without a skill. If this is work you will be asked to do again, save how you did it with save_skill before you answer, and say you did; skip it for a one-off.</reminder>`;

/** A tool's result with the reminder after it. */
export function withSkillNudge(content: string): string {
  return `${content}${SKILL_NUDGE}`;
}

/** A call's output as the chat stores it: the reminder, when it rode the result, taken off. */
export function withoutSkillNudge(output: string): string {
  return output.endsWith(SKILL_NUDGE) ? output.slice(0, -SKILL_NUDGE.length) : output;
}

/**
 * Whether a turn opens on a skill already: a `/<name>` that is not one of
 * the built-ins runs a skill of the bot's (`composeTurnMessage`).
 */
export function opensWithSkill(ranCommand: string | null | undefined): boolean {
  return (
    typeof ranCommand === 'string' &&
    !(BOT_BUILT_IN_COMMANDS as readonly string[]).includes(ranCommand)
  );
}

/**
 * One turn's count toward the reminder: each finished call of the turn's
 * own tools is reported in order, and the answer is whether that call's
 * result carries the reminder. It does once a turn, on the first call at or
 * past `BOT_SKILL_NUDGE_AFTER_STEPS` that may carry it, unless the turn
 * opened with a skill, has used (a built-in included), saved or fixed one,
 * or is a turn nobody is waiting on (a routine's run, a wake, a goal's
 * continuation, a loop's run: `BOT_ATTENDED_ORIGINS`), where nobody would
 * ask for the work again in words. A call that raised a card does not carry
 * it: the bot is told to end its turn there.
 */
export class BotSkillNudge {
  private steps = 0;
  private skilled: boolean;
  private nudged = false;
  private readonly attended: boolean;

  constructor(turn: { openedWithSkill: boolean; attended: boolean }) {
    this.skilled = turn.openedWithSkill;
    this.attended = turn.attended;
  }

  /** A call of `tool` finished; true when its result is the one to carry the reminder. */
  finished(tool: string, options: { asked: boolean }): boolean {
    this.steps += 1;
    if (SKILL_TOOLS.has(tool)) this.skilled = true;
    if (!this.attended || this.skilled || this.nudged || options.asked) return false;
    if (this.steps < BOT_SKILL_NUDGE_AFTER_STEPS) return false;
    this.nudged = true;
    return true;
  }
}

/** The line `use_skill` ends with: a skill followed and found wrong is fixed, not worked around. */
export const SKILL_FIX_NOTE =
  'If a step turns out wrong or out of date while you follow it, fix it with patch_skill once the task is done, and say so in your answer.';

/** A body with one passage replaced, or why it was not. */
export type SkillPatch =
  | { ok: true; body: string }
  | { ok: false; reason: 'absent' | 'ambiguous' | 'empty' | 'too_long' };

/**
 * Replaces the one occurrence of `oldText` in a skill's body with `newText`
 * (Claude Code's Edit, for a skill): a passage that is not there, or is there
 * more than once, changes nothing, nor does a result that would be empty or
 * over `BOT_SKILL_BODY_MAX` once trimmed, as the skill keeps it.
 */
export function patchSkillBody(body: string, oldText: string, newText: string): SkillPatch {
  const at = body.indexOf(oldText);
  if (oldText.length === 0 || at === -1) return { ok: false, reason: 'absent' };
  if (body.indexOf(oldText, at + 1) !== -1) return { ok: false, reason: 'ambiguous' };
  const patched = `${body.slice(0, at)}${newText}${body.slice(at + oldText.length)}`.trim();
  if (!patched) return { ok: false, reason: 'empty' };
  if (patched.length > BOT_SKILL_BODY_MAX) return { ok: false, reason: 'too_long' };
  return { ok: true, body: patched };
}

/** What a refused patch tells the bot, so it can fix the call or say why it did not. */
export function skillPatchRefusal(
  name: string,
  reason: Extract<SkillPatch, { ok: false }>['reason'],
): string {
  switch (reason) {
    case 'absent':
      return `Not changed: old_text is not in skill "${name}". Read it with use_skill and copy the passage exactly, whitespace included.`;
    case 'ambiguous':
      return `Not changed: old_text occurs more than once in skill "${name}". Include more of the text around it so it matches one place.`;
    case 'empty':
      return `Not changed: skill "${name}" would be empty. Delete it with delete_skill instead, only if the person asks.`;
    case 'too_long':
      return `Not changed: skill "${name}" would be over ${BOT_SKILL_BODY_MAX} characters. Make the change shorter.`;
  }
}

/**
 * Whether a name is one the product holds (`BOT_SKILL_RESERVED_NAMES`: a
 * built-in skill such as `recap`, or a built-in command) and the bot has no
 * row of its own under it: then the name means Oppenheimer's, which the bot
 * can neither save over nor fix. A row saved under the name before it was
 * reserved stays the bot's own (`withBuiltInSkills`).
 */
export function isOppenheimersSkillName(name: string, hasOwnRow: boolean): boolean {
  return !hasOwnRow && (BOT_SKILL_RESERVED_NAMES as readonly string[]).includes(name);
}

/**
 * Why a save or a fix under one of Oppenheimer's names does nothing, in the
 * create command's words ("Oppenheimer uses that name").
 */
export function oppenheimersSkillRefusal(name: string, action: 'saved' | 'changed'): string {
  return action === 'saved'
    ? `Not saved: a skill cannot be named "${name}": Oppenheimer uses that name. Pick another name.`
    : `Not changed: "${name}" is Oppenheimer's own (a skill every bot has, or a built-in command), and Oppenheimer uses that name; it cannot be changed. Propose the change in your answer instead, or save your own version under another name.`;
}

/**
 * Whether the bot may change an existing skill of its own on its own (a
 * save over it or a fix): one it wrote last, yes; one the person wrote
 * last, only when they asked for the change in this conversation, since it
 * is their words.
 */
export function skillChangeAllowed(input: { source: BotAuthor; askedByPerson: boolean }): boolean {
  return input.source !== 'user' || input.askedByPerson;
}

/** Why a change to the person's skill was not made, and what to do instead. */
export function theirSkillRefusal(name: string, action: 'saved' | 'changed'): string {
  return `Not ${action}: the person wrote skill "${name}" last, and did not ask you to change it. Propose the change in your answer instead; they can make it in Settings → Skills or ask you to.`;
}

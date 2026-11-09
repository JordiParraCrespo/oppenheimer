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
 * opened with a skill or has used, saved or fixed one. A call that raised a
 * card does not carry it: the bot is told to end its turn there.
 */
export class BotSkillNudge {
  private steps = 0;
  private skilled: boolean;
  private nudged = false;

  constructor(opensWithSkill: boolean) {
    this.skilled = opensWithSkill;
  }

  /** A call of `tool` finished; true when its result is the one to carry the reminder. */
  finished(tool: string, options: { asked: boolean }): boolean {
    this.steps += 1;
    if (SKILL_TOOLS.has(tool)) this.skilled = true;
    if (this.skilled || this.nudged || options.asked) return false;
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
 * Whose skill the bot may change on its own: one it wrote last, yes; one
 * the person wrote last, only when they asked for the change in this
 * conversation, since it is their words; a built-in command never, since it
 * is product code and not a skill (`BOT_BUILT_IN_COMMANDS`).
 */
export function skillPatchAllowed(input: {
  name: string;
  source: BotAuthor;
  askedByPerson: boolean;
}): 'allowed' | 'built_in' | 'theirs' {
  if ((BOT_SKILL_RESERVED_NAMES as readonly string[]).includes(input.name)) return 'built_in';
  if (input.source === 'user' && !input.askedByPerson) return 'theirs';
  return 'allowed';
}

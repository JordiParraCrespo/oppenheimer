import { z } from 'zod';

/**
 * A bot's skills (`product/versions/mvp/25-bots.md` §4.1, from OpenClaw's and
 * Grok Bot's, `research/lessons-from-openclaw-and-grok-bot-skills.md`): a
 * reusable way of doing one task, saved under a short name. The model sees each
 * skill's name and description every turn and reads the body only when a
 * request calls for it (`use_skill`); the person runs one by typing
 * `/<name>` in the chat.
 */

/**
 * A skill's name is its slash command: lowercase letters, digits and hyphens,
 * starting with a letter or a digit, at most 32 characters (OpenClaw's cap).
 */
export const BOT_SKILL_NAME_MAX = 32;
export const BOT_SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;
/** What the prompt's skills list shows, so it says when to reach for the skill. */
export const BOT_SKILL_DESCRIPTION_MAX = 280;
/**
 * The skill itself, in Markdown: the steps, the checks, what to report. Under
 * the 12,000 characters a bot's tool answer holds, with room for its name and
 * description around it, so `use_skill` always hands the whole skill back and
 * never one with its middle cut out.
 */
export const BOT_SKILL_BODY_MAX = 10_000;
/** How many skills one bot keeps: every name and description is in each turn's prompt. */
export const BOT_SKILLS_MAX = 50;

/**
 * A name as it is being typed into a field: lowercase, every run of anything
 * else a hyphen, none at the start, cut to the cap. A hyphen at the end stays,
 * since the next key may finish the word (`release-` before `notes`).
 */
export function botSkillNameDraft(typed: string): string {
  return typed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, BOT_SKILL_NAME_MAX);
}

/**
 * Turns a typed name into a skill's name, as OpenClaw sanitises its commands:
 * the draft, with no hyphen at the end either. Empty when nothing usable is
 * left.
 */
export function botSkillNameOf(typed: string): string {
  return botSkillNameDraft(typed).replace(/-+$/, '');
}

/**
 * A message that runs a skill: `/<name>` at its very start, then, after
 * whitespace, what the person gave it (`/release-notes v2.3`). `/skill <name>`
 * is the same, as OpenClaw's generic entry point. A name that is not a skill's
 * shape is no command, and the message is read as written.
 */
export interface BotSlashCommand {
  name: string;
  args: string;
}

const SLASH = /^\/([a-z0-9][a-z0-9-]{0,31})(?:\s+([\s\S]*))?$/;

export function parseBotSlashCommand(message: string): BotSlashCommand | null {
  const match = SLASH.exec(message.trim());
  if (!match?.[1]) return null;
  const args = (match[2] ?? '').trim();
  if (match[1] === 'skill') {
    const inner = /^([a-z0-9][a-z0-9-]{0,31})(?:\s+([\s\S]*))?$/.exec(args);
    return inner?.[1] ? { name: inner[1], args: (inner[2] ?? '').trim() } : null;
  }
  return { name: match[1], args };
}

/**
 * The commands Oppenheimer runs itself, whatever skills the bot has
 * (`25-bots.md` §4.1, "Built-in commands"; from Claude Code's): a built-in
 * drives a feature the product owns, where a skill only puts words in front
 * of the bot. `goal` sets, shows or clears the bot's goal; `usage` shows
 * what the chat has spent, and is the console's alone; `loop` runs a prompt
 * again and again, or stops the loop; `schedule` has the bot save a routine
 * on a schedule, or opens its routines.
 */
export const BOT_BUILT_IN_COMMANDS = ['goal', 'usage', 'loop', 'schedule'] as const;
export type BotBuiltInCommand = (typeof BOT_BUILT_IN_COMMANDS)[number];

/**
 * `skill` is the generic entry point and each built-in, command or skill, is
 * the product's, so no skill may take one as its own name. A skill saved under one before it
 * was reserved keeps its row and stays the bot's to use, but its `/<name>`
 * runs the built-in.
 */
/**
 * The skills Oppenheimer gives every bot (the API's `BOT_BUILT_IN_SKILLS`):
 * `oppenheimer` reads Oppenheimer's own guide before the bot answers a
 * question about Oppenheimer. The bot uses one unasked; the person does not
 * run it as a command.
 */
export const BOT_BUILT_IN_SKILL_NAMES = ['oppenheimer'] as const;
export type BotBuiltInSkillName = (typeof BOT_BUILT_IN_SKILL_NAMES)[number];

export const BOT_SKILL_RESERVED_NAMES = [
  'skill',
  ...BOT_BUILT_IN_COMMANDS,
  ...BOT_BUILT_IN_SKILL_NAMES,
] as const;

/** The words after `/goal` that clear it rather than set one (Claude Code's aliases). */
export const BOT_GOAL_CLEAR_WORDS = ['clear', 'stop', 'off', 'reset', 'none', 'cancel'] as const;

/**
 * What a `/goal` asks for: nothing after it shows the goal, a clear word
 * stops it, anything else is the condition of a new goal, which replaces the
 * one there is. Null for a command that is not `/goal`.
 */
export type BotGoalCommand =
  | { kind: 'show' }
  | { kind: 'clear' }
  | { kind: 'set'; condition: string };

/**
 * Whether a message is a built-in the console runs itself and never sends:
 * `/goal` alone, `/goal clear` and `/loop stop` (and their aliases),
 * `/schedule` alone, and `/usage`, whatever follows it. `/goal <condition>`,
 * `/loop …` and `/schedule <request>` are messages: the API sets the goal or
 * the loop, or the bot saves the routine.
 */
export function isBotConsoleCommand(command: BotSlashCommand | null): boolean {
  if (command?.name === 'usage') return true;
  if (botScheduleCommandOf(command)?.kind === 'open') return true;
  if (botLoopCommandOf(command)?.kind === 'clear') return true;
  const goal = botGoalCommandOf(command);
  return goal !== null && goal.kind !== 'set';
}

export function botGoalCommandOf(command: BotSlashCommand | null): BotGoalCommand | null {
  if (command?.name !== 'goal') return null;
  const args = command.args.trim();
  if (!args) return { kind: 'show' };
  if ((BOT_GOAL_CLEAR_WORDS as readonly string[]).includes(args.toLowerCase())) {
    return { kind: 'clear' };
  }
  return { kind: 'set', condition: args };
}

/**
 * `/loop` (`25-bots.md` §4.1; from Claude Code's `/loop`): a prompt run now
 * and again every interval, from a minute to a day, or self-paced, when the
 * bot says next (`schedule_loop`, up to an hour away). A loop expires
 * `BOT_LOOP_LIFETIME_MS` after it was set. This is the longest prompt.
 */
export const BOT_LOOP_PROMPT_MAX = 2_000;
export const BOT_LOOP_INTERVAL_MIN_MINUTES = 1;
export const BOT_LOOP_INTERVAL_MAX_MINUTES = 1_440;
/** How far ahead a self-paced loop's next run may be. */
export const BOT_LOOP_SELF_PACED_MAX_MINUTES = 60;
export const BOT_LOOP_LIFETIME_MS = 3 * 24 * 60 * 60 * 1_000;

/** What `/loop` with no prompt runs, as Claude Code's runs its maintenance prompt. */
export const BOT_LOOP_CHECK_IN_PROMPT =
  'Check in: read your instructions, your open sessions and anything you were asked to watch, and report only what changed since your last run.';

/**
 * What a `/loop` asks for: a clear word stops the loop; anything else sets
 * one, with its interval in minutes (null for self-paced) and its prompt
 * (the check-in prompt when none is written). An interval out of range is
 * `invalid`, so it is never read as words of the prompt. Null for a command
 * that is not `/loop`.
 */
export type BotLoopCommand =
  | { kind: 'clear' }
  | { kind: 'set'; intervalMinutes: number | null; prompt: string }
  | { kind: 'invalid' };

const INTERVAL = /^(\d{1,6})\s*(s|secs?|seconds?|m|mins?|minutes?|h|hrs?|hours?|d|days?)$/i;
const TRAILING_EVERY = /\s+every\s+(\d{1,6}\s*[a-z]+)$/i;
const MINUTES_PER: Record<string, number> = { s: 1 / 60, m: 1, h: 60, d: 1_440 };

/** An interval's minutes, a part minute rounded up; null when the words are no interval. */
export function botLoopIntervalOf(words: string): number | null {
  const match = INTERVAL.exec(words.trim());
  if (!match?.[1] || !match[2]) return null;
  const unit = match[2].toLowerCase().startsWith('mi') ? 'm' : match[2].toLowerCase().charAt(0);
  return Math.ceil(Number(match[1]) * (MINUTES_PER[unit] ?? 1));
}

export function botLoopCommandOf(command: BotSlashCommand | null): BotLoopCommand | null {
  if (command?.name !== 'loop') return null;
  let args = command.args.trim();
  if ((BOT_GOAL_CLEAR_WORDS as readonly string[]).includes(args.toLowerCase())) {
    return { kind: 'clear' };
  }
  let interval: number | null = null;
  const [first = '', ...rest] = args.split(/\s+/);
  const leading = botLoopIntervalOf(first);
  const trailing = TRAILING_EVERY.exec(args);
  if (leading !== null) {
    interval = leading;
    args = rest.join(' ');
  } else if (trailing?.[1] && botLoopIntervalOf(trailing[1]) !== null) {
    interval = botLoopIntervalOf(trailing[1]);
    args = args.slice(0, trailing.index).trim();
  }
  if (
    interval !== null &&
    (interval < BOT_LOOP_INTERVAL_MIN_MINUTES || interval > BOT_LOOP_INTERVAL_MAX_MINUTES)
  ) {
    return { kind: 'invalid' };
  }
  return {
    kind: 'set',
    intervalMinutes: interval,
    prompt: args.trim() || BOT_LOOP_CHECK_IN_PROMPT,
  };
}

/**
 * `/schedule` (`25-bots.md` §4.1; from Claude Code's `/schedule`): the bot
 * saves a routine (`26-bot-routines.md`) from the person's words, what to do
 * and when ("every weekday at 9, check open PRs"), on a calendar where a
 * loop runs on minutes. Nothing after it opens the bot's routines instead.
 * Null for a command that is not `/schedule`.
 */
export type BotScheduleCommand = { kind: 'open' } | { kind: 'set'; request: string };

export function botScheduleCommandOf(command: BotSlashCommand | null): BotScheduleCommand | null {
  if (command?.name !== 'schedule') return null;
  const request = command.args.trim();
  return request ? { kind: 'set', request } : { kind: 'open' };
}

/** A name a skill can carry: what can be typed after a slash. */
const skillNameShapeSchema = z
  .string()
  .trim()
  .min(1)
  .max(BOT_SKILL_NAME_MAX)
  .regex(BOT_SKILL_NAME_PATTERN);
/**
 * A name a skill can be given: never one Oppenheimer holds. Only a new skill
 * is always given its name; an edit may resend the name a skill already has,
 * reserved before or not, so the update schema checks the shape alone and the
 * API refuses a rename onto a reserved name (`BotSkillEntity`).
 */
const skillNameSchema = skillNameShapeSchema.refine(
  (name) => !(BOT_SKILL_RESERVED_NAMES as readonly string[]).includes(name),
  { params: { i18nKey: 'validation.invalid' } },
);
const skillDescriptionSchema = z.string().trim().min(1).max(BOT_SKILL_DESCRIPTION_MAX);
const skillBodySchema = z.string().trim().min(1).max(BOT_SKILL_BODY_MAX);

/**
 * `POST /bots/:id/skills`. `userInvocable` (OpenClaw's `user-invocable`) makes
 * it a slash command; `modelInvocable` (the inverse of its
 * `disable-model-invocation`) lists it in the prompt so the bot may use it on
 * its own. Both default to on.
 */
export const botSkillSchema = z.object({
  name: skillNameSchema,
  description: skillDescriptionSchema,
  body: skillBodySchema,
  userInvocable: z.boolean().optional(),
  modelInvocable: z.boolean().optional(),
});
export type BotSkillDto = z.infer<typeof botSkillSchema>;

/**
 * The console's skill form on a skill that exists: its name may be the one it
 * already has, reserved after it was saved, so the name is checked for its
 * shape alone and a rename onto a reserved name is the API's to refuse.
 */
export const editBotSkillSchema = botSkillSchema.extend({ name: skillNameShapeSchema });

/** `PATCH /bots/:id/skills/:skillId`: any of its parts, at least one. */
export const updateBotSkillSchema = z
  .object({
    name: skillNameShapeSchema.optional(),
    description: skillDescriptionSchema.optional(),
    body: skillBodySchema.optional(),
    userInvocable: z.boolean().optional(),
    modelInvocable: z.boolean().optional(),
  })
  .refine((change) => Object.values(change).some((value) => value !== undefined), {
    params: { i18nKey: 'validation.required' },
  });
export type UpdateBotSkillDto = z.infer<typeof updateBotSkillSchema>;

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

/** `skill` is the generic entry point, so no skill may take it as its own name. */
export const BOT_SKILL_RESERVED_NAMES = ['skill'] as const;

const skillNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(BOT_SKILL_NAME_MAX)
  .regex(BOT_SKILL_NAME_PATTERN)
  .refine((name) => !(BOT_SKILL_RESERVED_NAMES as readonly string[]).includes(name), {
    params: { i18nKey: 'validation.invalid' },
  });
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

/** `PATCH /bots/:id/skills/:skillId`: any of its parts, at least one. */
export const updateBotSkillSchema = z
  .object({
    name: skillNameSchema.optional(),
    description: skillDescriptionSchema.optional(),
    body: skillBodySchema.optional(),
    userInvocable: z.boolean().optional(),
    modelInvocable: z.boolean().optional(),
  })
  .refine((change) => Object.values(change).some((value) => value !== undefined), {
    params: { i18nKey: 'validation.required' },
  });
export type UpdateBotSkillDto = z.infer<typeof updateBotSkillSchema>;

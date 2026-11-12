import {
  BOT_BUILT_IN_SKILL_TEXTS,
  type BotBuiltInSkillText,
} from '@oppenheimer/shared/schemas/bot-skill';

/**
 * The built-in skills a bot has beside its own, as Settings → Skills lists
 * them: every one whose name none of its own holds, since a skill saved
 * under a built-in's name before it was reserved is the one the bot uses
 * (the API's `withBuiltInSkills`).
 */
export function builtInSkillsBeside(own: readonly { name: string }[]): BotBuiltInSkillText[] {
  return BOT_BUILT_IN_SKILL_TEXTS.filter((skill) => !own.some((mine) => mine.name === skill.name));
}

import type { BotBuiltInSkillName } from '@oppenheimer/shared';

/** What the prompt and the tools read of a skill. */
export interface BotSkillView {
  name: string;
  description: string;
  body: string;
  userInvocable: boolean;
  modelInvocable: boolean;
}

/** A skill the product ships to every bot, listed while the tools it follows with are offered. */
export interface BotBuiltInSkill extends BotSkillView {
  /** One of `BOT_BUILT_IN_SKILL_NAMES`, which no skill of a bot's may be given. */
  name: BotBuiltInSkillName;
  /** The tools the skill's steps call: without every one the skill has nothing to follow with. */
  needsTools: readonly string[];
}

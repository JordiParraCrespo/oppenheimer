import type { BotSkillEntity } from '@oppenheimer/frontend-consumer';

/** Who runs a skill, as its row's tag reads: none when both the person and the bot do. */
export type SkillKind = 'onlyYou' | 'onlyBot' | null;

/** How a skill's row reads: who saved it, and a tag when only one side runs it. */
export interface SkillRowModel {
  meta: 'byYou' | 'byBot';
  kind: SkillKind;
}

export function skillKind(
  skill: Pick<BotSkillEntity, 'userInvocable' | 'modelInvocable'>,
): SkillKind {
  return !skill.modelInvocable ? 'onlyYou' : !skill.userInvocable ? 'onlyBot' : null;
}

export function skillRowModel(
  skill: Pick<BotSkillEntity, 'source' | 'userInvocable' | 'modelInvocable'>,
): SkillRowModel {
  return { meta: skill.source === 'bot' ? 'byBot' : 'byYou', kind: skillKind(skill) };
}

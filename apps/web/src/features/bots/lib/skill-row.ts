import type { BotSkillEntity } from '@oppenheimer/frontend-consumer';

/** How a skill's row reads: who saved it, and a tag when only one side runs it. */
export interface SkillRowModel {
  meta: 'byYou' | 'byBot';
  kind: 'onlyYou' | 'onlyBot' | null;
}

export function skillRowModel(
  skill: Pick<BotSkillEntity, 'source' | 'userInvocable' | 'modelInvocable'>,
): SkillRowModel {
  return {
    meta: skill.source === 'bot' ? 'byBot' : 'byYou',
    kind: !skill.modelInvocable ? 'onlyYou' : !skill.userInvocable ? 'onlyBot' : null,
  };
}

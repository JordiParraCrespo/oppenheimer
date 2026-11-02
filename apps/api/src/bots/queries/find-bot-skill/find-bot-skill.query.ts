import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

/** One skill of a bot, by its id or by its name (what a slash command or `use_skill` names). */
export class FindBotSkillQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly skill: { id: string } | { name: string };

  constructor(props: {
    scope: AccessScope;
    botId: string;
    skill: { id: string } | { name: string };
  }) {
    super();
    this.scope = props.scope;
    this.botId = props.botId;
    this.skill = props.skill;
  }
}

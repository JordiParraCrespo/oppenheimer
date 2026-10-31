import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { BotAuthor } from '@oppenheimer/shared';
import type { BotSkillChange } from '../../domain/bot-skill.entity';

export class UpdateBotSkillCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly skillId: string;
  readonly change: BotSkillChange;
  /** Who changes it: a person in Settings (the default), or the bot through `save_skill`. */
  readonly author?: BotAuthor;

  constructor(props: CommandProps<UpdateBotSkillCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.skillId = props.skillId;
    this.change = props.change;
    this.author = props.author;
  }
}

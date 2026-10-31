import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { BotAuthor } from '@oppenheimer/shared';

export class CreateBotSkillCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly name: string;
  readonly description: string;
  readonly body: string;
  readonly userInvocable?: boolean;
  readonly modelInvocable?: boolean;
  /** Who writes it: a person in Settings (the default), or the bot through `save_skill`. */
  readonly author?: BotAuthor;

  constructor(props: CommandProps<CreateBotSkillCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.name = props.name;
    this.description = props.description;
    this.body = props.body;
    this.userInvocable = props.userInvocable;
    this.modelInvocable = props.modelInvocable;
    this.author = props.author;
  }
}

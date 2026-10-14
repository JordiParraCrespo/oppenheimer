import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { CreateBotDto } from '@oppenheimer/shared';

export class CreateBotCommand extends CommandBase {
  /** The caller, who is recorded as the bot's creator and its documents' first author. */
  readonly scope: AccessScope;
  readonly input: CreateBotDto;

  constructor(props: CommandProps<CreateBotCommand>) {
    super(props);
    this.scope = props.scope;
    this.input = props.input;
  }
}

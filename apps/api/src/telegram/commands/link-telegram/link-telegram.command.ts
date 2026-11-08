import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class LinkTelegramCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly hostId: string;
  /** The bot's BotFather token: handed to the host, never kept or logged here. */
  readonly token: string;
  readonly label?: string;

  constructor(props: CommandProps<LinkTelegramCommand>) {
    super(props);
    this.scope = props.scope;
    this.hostId = props.hostId;
    this.token = props.token;
    this.label = props.label;
  }
}

import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class ConnectSlackCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly botToken: string;
  readonly signingSecret: string;

  constructor(props: CommandProps<ConnectSlackCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.botToken = props.botToken;
    this.signingSecret = props.signingSecret;
  }
}

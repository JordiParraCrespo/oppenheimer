import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { ConnectGmailDto } from '@oppenheimer/shared';

export class ConnectGmailCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly input: ConnectGmailDto;

  constructor(props: CommandProps<ConnectGmailCommand>) {
    super(props);
    this.scope = props.scope;
    this.input = props.input;
  }
}

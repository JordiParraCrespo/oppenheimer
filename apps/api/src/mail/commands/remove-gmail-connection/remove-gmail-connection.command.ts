import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class RemoveGmailConnectionCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly connectionId: string;

  constructor(props: CommandProps<RemoveGmailConnectionCommand>) {
    super(props);
    this.scope = props.scope;
    this.connectionId = props.connectionId;
  }
}

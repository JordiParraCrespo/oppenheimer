import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class UnpairHostCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly hostId: string;

  constructor(props: CommandProps<UnpairHostCommand>) {
    super(props);
    this.scope = props.scope;
    this.hostId = props.hostId;
  }
}

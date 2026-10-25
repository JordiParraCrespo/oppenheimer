import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class UpdateHostRunnerCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly hostId: string;

  constructor(props: CommandProps<UpdateHostRunnerCommand>) {
    super(props);
    this.scope = props.scope;
    this.hostId = props.hostId;
  }
}

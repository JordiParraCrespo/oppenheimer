import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class RenameHostCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly hostId: string;
  readonly name: string;

  constructor(props: CommandProps<RenameHostCommand>) {
    super(props);
    this.scope = props.scope;
    this.hostId = props.hostId;
    this.name = props.name;
  }
}

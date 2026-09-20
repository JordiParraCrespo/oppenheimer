import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class RenameSessionCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  readonly name: string;

  constructor(props: CommandProps<RenameSessionCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.name = props.name;
  }
}

import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class RevokeAccessGrantCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly grantId: string;

  constructor(props: CommandProps<RevokeAccessGrantCommand>) {
    super(props);
    this.scope = props.scope;
    this.grantId = props.grantId;
  }
}

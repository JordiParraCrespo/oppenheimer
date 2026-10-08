import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class RevokeShareLinkCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  readonly linkId: string;

  constructor(props: CommandProps<RevokeShareLinkCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.linkId = props.linkId;
  }
}

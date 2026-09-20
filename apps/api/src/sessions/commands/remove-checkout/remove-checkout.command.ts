import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class RemoveCheckoutCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  readonly checkoutId: string;

  constructor(props: CommandProps<RemoveCheckoutCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.checkoutId = props.checkoutId;
  }
}

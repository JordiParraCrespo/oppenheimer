import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class CloseSessionCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  /** Whether the caller accepts losing work that is not pushed. Default is no. */
  readonly acceptUnpushedWork: boolean;

  constructor(props: CommandProps<CloseSessionCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.acceptUnpushedWork = props.acceptUnpushedWork;
  }
}

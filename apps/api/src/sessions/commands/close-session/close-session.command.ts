import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

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

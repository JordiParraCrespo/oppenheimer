import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class MoveSessionCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  readonly projectId: string;

  constructor(props: CommandProps<MoveSessionCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.projectId = props.projectId;
  }
}

import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class StopSessionCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;

  constructor(props: CommandProps<StopSessionCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
  }
}

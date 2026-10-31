import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class StopSessionShareCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;

  constructor(props: CommandProps<StopSessionShareCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
  }
}

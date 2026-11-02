import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

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

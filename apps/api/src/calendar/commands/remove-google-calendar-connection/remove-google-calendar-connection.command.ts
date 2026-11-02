import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class RemoveGoogleCalendarConnectionCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly connectionId: string;

  constructor(props: CommandProps<RemoveGoogleCalendarConnectionCommand>) {
    super(props);
    this.scope = props.scope;
    this.connectionId = props.connectionId;
  }
}

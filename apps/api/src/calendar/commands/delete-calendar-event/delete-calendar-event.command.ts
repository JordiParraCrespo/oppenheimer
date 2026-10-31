import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class DeleteCalendarEventCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly eventId: string;

  constructor(props: CommandProps<DeleteCalendarEventCommand>) {
    super(props);
    this.scope = props.scope;
    this.eventId = props.eventId;
  }
}

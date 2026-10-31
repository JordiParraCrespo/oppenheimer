import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { UpdateCalendarEventDto } from '@oppenheimer/shared';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class UpdateCalendarEventCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly eventId: string;
  readonly changes: UpdateCalendarEventDto;

  constructor(props: CommandProps<UpdateCalendarEventCommand>) {
    super(props);
    this.scope = props.scope;
    this.eventId = props.eventId;
    this.changes = props.changes;
  }
}

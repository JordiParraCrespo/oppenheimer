import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { UpdateCalendarEventDto } from '@oppenheimer/shared';

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

import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class DeleteCalendarEventCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly eventId: string;

  constructor(props: CommandProps<DeleteCalendarEventCommand>) {
    super(props);
    this.scope = props.scope;
    this.eventId = props.eventId;
  }
}

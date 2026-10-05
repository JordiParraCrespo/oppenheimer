import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { CreateCalendarEventDto } from '@oppenheimer/shared';

export class CreateCalendarEventCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly userId: string;
  readonly input: CreateCalendarEventDto;

  constructor(props: CommandProps<CreateCalendarEventCommand>) {
    super(props);
    this.scope = props.scope;
    this.userId = props.userId;
    this.input = props.input;
  }
}

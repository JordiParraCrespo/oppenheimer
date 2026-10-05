import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class StartGoogleCalendarConnectionCommand extends CommandBase {
  readonly scope: AccessScope;

  constructor(props: CommandProps<StartGoogleCalendarConnectionCommand>) {
    super(props);
    this.scope = props.scope;
  }
}

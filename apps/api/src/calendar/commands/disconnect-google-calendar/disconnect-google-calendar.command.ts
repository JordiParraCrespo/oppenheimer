import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class DisconnectGoogleCalendarCommand extends CommandBase {
  readonly scope: AccessScope;

  constructor(props: CommandProps<DisconnectGoogleCalendarCommand>) {
    super(props);
    this.scope = props.scope;
  }
}

import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { ConnectGoogleCalendarDto } from '@oppenheimer/shared';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class ConnectGoogleCalendarCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly input: ConnectGoogleCalendarDto;

  constructor(props: CommandProps<ConnectGoogleCalendarCommand>) {
    super(props);
    this.scope = props.scope;
    this.input = props.input;
  }
}

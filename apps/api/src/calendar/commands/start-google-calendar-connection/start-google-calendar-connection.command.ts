import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { StartGoogleCalendarConnectionDto } from '@oppenheimer/shared';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class StartGoogleCalendarConnectionCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly input: StartGoogleCalendarConnectionDto;

  constructor(props: CommandProps<StartGoogleCalendarConnectionCommand>) {
    super(props);
    this.scope = props.scope;
    this.input = props.input;
  }
}

import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { StartGmailConnectionDto } from '@oppenheimer/shared';

export class StartGmailConnectionCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly input: StartGmailConnectionDto;

  constructor(props: CommandProps<StartGmailConnectionCommand>) {
    super(props);
    this.scope = props.scope;
    this.input = props.input;
  }
}

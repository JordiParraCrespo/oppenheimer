import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { UpdateGmailConnectionDto } from '@oppenheimer/shared';

export class UpdateGmailConnectionCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly connectionId: string;
  readonly input: UpdateGmailConnectionDto;

  constructor(props: CommandProps<UpdateGmailConnectionCommand>) {
    super(props);
    this.scope = props.scope;
    this.connectionId = props.connectionId;
    this.input = props.input;
  }
}

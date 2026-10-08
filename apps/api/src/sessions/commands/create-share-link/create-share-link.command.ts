import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { CreateShareLinkDto } from '@oppenheimer/shared';

export class CreateShareLinkCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  readonly userId: string;
  readonly link: CreateShareLinkDto;

  constructor(props: CommandProps<CreateShareLinkCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.userId = props.userId;
    this.link = props.link;
  }
}

import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { PutSessionShareDto } from '@oppenheimer/shared';

export class PutSessionShareCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  readonly userId: string;
  readonly share: PutSessionShareDto;

  constructor(props: CommandProps<PutSessionShareCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.userId = props.userId;
    this.share = props.share;
  }
}

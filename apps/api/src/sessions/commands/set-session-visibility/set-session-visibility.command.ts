import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class SetSessionVisibilityCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  readonly hidden: boolean;

  constructor(props: CommandProps<SetSessionVisibilityCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.hidden = props.hidden;
  }
}

import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class RemoveSentryConnectionCommand extends CommandBase {
  readonly scope: AccessScope;

  constructor(props: CommandProps<RemoveSentryConnectionCommand>) {
    super(props);
    this.scope = props.scope;
  }
}

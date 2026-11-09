import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class RemoveTelegramAccountCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly accountId: string;

  constructor(props: CommandProps<RemoveTelegramAccountCommand>) {
    super(props);
    this.scope = props.scope;
    this.accountId = props.accountId;
  }
}

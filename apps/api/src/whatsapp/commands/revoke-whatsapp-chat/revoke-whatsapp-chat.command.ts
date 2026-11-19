import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class RevokeWhatsappChatCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly accountId: string;
  readonly grantId: string;

  constructor(props: CommandProps<RevokeWhatsappChatCommand>) {
    super(props);
    this.scope = props.scope;
    this.accountId = props.accountId;
    this.grantId = props.grantId;
  }
}

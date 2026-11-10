import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class ConfirmWhatsappOwnerCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly accountId: string;
  /** The six digits the owner's number received. */
  readonly code: string;

  constructor(props: CommandProps<ConfirmWhatsappOwnerCommand>) {
    super(props);
    this.scope = props.scope;
    this.accountId = props.accountId;
    this.code = props.code;
  }
}

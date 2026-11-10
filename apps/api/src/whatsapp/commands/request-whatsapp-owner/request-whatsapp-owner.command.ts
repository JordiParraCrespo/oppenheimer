import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class RequestWhatsappOwnerCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly accountId: string;
  /** The owner's own number, in international form, as they typed it. */
  readonly phone: string;

  constructor(props: CommandProps<RequestWhatsappOwnerCommand>) {
    super(props);
    this.scope = props.scope;
    this.accountId = props.accountId;
    this.phone = props.phone;
  }
}

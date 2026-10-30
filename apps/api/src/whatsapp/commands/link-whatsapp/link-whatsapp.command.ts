import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class LinkWhatsappCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly hostId: string;
  readonly label?: string;

  constructor(props: CommandProps<LinkWhatsappCommand>) {
    super(props);
    this.scope = props.scope;
    this.hostId = props.hostId;
    this.label = props.label;
  }
}

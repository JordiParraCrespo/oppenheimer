import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

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

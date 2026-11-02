import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class RemoveWhatsappAccountCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly accountId: string;

  constructor(props: CommandProps<RemoveWhatsappAccountCommand>) {
    super(props);
    this.scope = props.scope;
    this.accountId = props.accountId;
  }
}

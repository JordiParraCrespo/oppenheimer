import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class DeleteModelProviderCredentialCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly provider: string;

  constructor(props: CommandProps<DeleteModelProviderCredentialCommand>) {
    super(props);
    this.scope = props.scope;
    this.provider = props.provider;
  }
}

import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class PutCloudAgentCredentialCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly provider: string;
  readonly apiKey: string;

  constructor(props: CommandProps<PutCloudAgentCredentialCommand>) {
    super(props);
    this.scope = props.scope;
    this.provider = props.provider;
    this.apiKey = props.apiKey;
  }
}

import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class PutModelProviderCredentialCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly provider: string;
  readonly apiKey: string;

  constructor(props: CommandProps<PutModelProviderCredentialCommand>) {
    super(props);
    this.scope = props.scope;
    this.provider = props.provider;
    this.apiKey = props.apiKey;
  }
}

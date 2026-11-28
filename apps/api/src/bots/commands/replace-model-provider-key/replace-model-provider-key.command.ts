import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class ReplaceModelProviderKeyCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly provider: string;
  readonly keyId: string;
  readonly apiKey: string;

  constructor(props: CommandProps<ReplaceModelProviderKeyCommand>) {
    super(props);
    this.scope = props.scope;
    this.provider = props.provider;
    this.keyId = props.keyId;
    this.apiKey = props.apiKey;
  }
}

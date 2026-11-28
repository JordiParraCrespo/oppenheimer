import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class DeleteModelProviderKeyCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly provider: string;
  readonly keyId: string;

  constructor(props: CommandProps<DeleteModelProviderKeyCommand>) {
    super(props);
    this.scope = props.scope;
    this.provider = props.provider;
    this.keyId = props.keyId;
  }
}

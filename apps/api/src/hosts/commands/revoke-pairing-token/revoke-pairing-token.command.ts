import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class RevokePairingTokenCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly tokenId: string;

  constructor(props: CommandProps<RevokePairingTokenCommand>) {
    super(props);
    this.scope = props.scope;
    this.tokenId = props.tokenId;
  }
}

import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class MintPairingTokenCommand extends CommandBase {
  readonly userId: string;
  /** Scopes the lookup of the token being replaced to the caller's own. */
  readonly scope: AccessScope;
  readonly name: string;
  /** The caller's token this mint revokes in the same write: "New token". */
  readonly replaces?: string;
  /** Where the request came from, recorded so a stranger's mint is visible (F5). */
  readonly createdFromIp: string | null;

  constructor(props: CommandProps<MintPairingTokenCommand>) {
    super(props);
    this.userId = props.userId;
    this.scope = props.scope;
    this.name = props.name;
    this.replaces = props.replaces;
    this.createdFromIp = props.createdFromIp;
  }
}

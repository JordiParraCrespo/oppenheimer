import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class UnpairHostCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly hostId: string;
  /** Also clean the machine up: close every session and remove its worktrees. */
  readonly wipe: boolean;

  constructor(props: CommandProps<UnpairHostCommand>) {
    super(props);
    this.scope = props.scope;
    this.hostId = props.hostId;
    this.wipe = props.wipe;
  }
}

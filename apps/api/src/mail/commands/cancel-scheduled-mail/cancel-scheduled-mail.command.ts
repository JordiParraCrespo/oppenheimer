import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

/** Stops one of the caller's scheduled sends while it still waits. */
export class CancelScheduledMailCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sendId: string;

  constructor(props: CommandProps<CancelScheduledMailCommand>) {
    super(props);
    this.scope = props.scope;
    this.sendId = props.sendId;
  }
}

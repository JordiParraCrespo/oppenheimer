import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import type { PullRequestAddress } from '../../../github/application/pull-request-access.port';

export class StartReviewSessionCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly userId: string;
  readonly address: PullRequestAddress;
  readonly hostId: string;
  /** The caller's `Idempotency-Key`, so a retry after a lost answer finds the session it made. */
  readonly idempotencyKey: string | null;

  constructor(props: CommandProps<StartReviewSessionCommand>) {
    super(props);
    this.scope = props.scope;
    this.userId = props.userId;
    this.address = props.address;
    this.hostId = props.hostId;
    this.idempotencyKey = props.idempotencyKey;
  }
}

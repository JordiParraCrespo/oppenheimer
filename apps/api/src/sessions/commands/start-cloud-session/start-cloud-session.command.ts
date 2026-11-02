import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { StartCloudSessionDto } from '@oppenheimer/shared';
import type { SessionOrigin } from '../../domain/session-turn.policy';

export class StartCloudSessionCommand extends CommandBase {
  readonly scope: AccessScope;
  /** Whose session it is, and whose key at the vendor its agent runs on. */
  readonly userId: string;
  readonly input: StartCloudSessionDto;
  /** The caller's `Idempotency-Key` header, so a retry returns this session. */
  readonly idempotencyKey: string | null;
  readonly origin: SessionOrigin;

  constructor(props: CommandProps<StartCloudSessionCommand>) {
    super(props);
    this.scope = props.scope;
    this.userId = props.userId;
    this.input = props.input;
    this.idempotencyKey = props.idempotencyKey;
    this.origin = props.origin;
  }
}

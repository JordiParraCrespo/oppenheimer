import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { CreateMilestoneDto } from '@oppenheimer/shared';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import type { PlanActor } from '../../domain/plan-change.types';

export class CreateMilestoneCommand extends CommandBase {
  readonly scope: AccessScope;
  /** Who is acting: the caller, or an agent for them. */
  readonly actor: PlanActor;
  /** The caller's `Idempotency-Key`, so a retried create makes one row. */
  readonly idempotencyKey: string | null;
  readonly userId: string;
  readonly input: CreateMilestoneDto;

  constructor(props: CommandProps<CreateMilestoneCommand>) {
    super(props);
    this.scope = props.scope;
    this.actor = props.actor;
    this.idempotencyKey = props.idempotencyKey;
    this.userId = props.userId;
    this.input = props.input;
  }
}

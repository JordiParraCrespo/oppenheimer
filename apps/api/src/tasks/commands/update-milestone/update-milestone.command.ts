import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { UpdateMilestoneDto } from '@oppenheimer/shared';
import type { PlanActor } from '../../domain/plan-change.types';

export class UpdateMilestoneCommand extends CommandBase {
  readonly scope: AccessScope;
  /** Who is acting: the caller, or an agent for them. */
  readonly actor: PlanActor;
  readonly milestoneId: string;
  readonly changes: UpdateMilestoneDto;

  constructor(props: CommandProps<UpdateMilestoneCommand>) {
    super(props);
    this.scope = props.scope;
    this.actor = props.actor;
    this.milestoneId = props.milestoneId;
    this.changes = props.changes;
  }
}

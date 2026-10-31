import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { UpdateTaskDto } from '@oppenheimer/shared';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import type { PlanActor } from '../../domain/plan-change.types';

export class UpdateTaskCommand extends CommandBase {
  readonly scope: AccessScope;
  /** Who is acting: the caller, or an agent for them. */
  readonly actor: PlanActor;
  readonly taskId: string;
  readonly changes: UpdateTaskDto;

  constructor(props: CommandProps<UpdateTaskCommand>) {
    super(props);
    this.scope = props.scope;
    this.actor = props.actor;
    this.taskId = props.taskId;
    this.changes = props.changes;
  }
}

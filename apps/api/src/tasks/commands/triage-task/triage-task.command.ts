import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { TaskOrigin } from '@oppenheimer/shared';
import type { PlanActor } from '../../domain/plan-change.types';

export class TriageTaskCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly actor: PlanActor;
  /** Only the person's own request takes the task up. */
  readonly origin: TaskOrigin;
  readonly taskId: string;

  constructor(props: CommandProps<TriageTaskCommand>) {
    super(props);
    this.scope = props.scope;
    this.actor = props.actor;
    this.origin = props.origin;
    this.taskId = props.taskId;
  }
}

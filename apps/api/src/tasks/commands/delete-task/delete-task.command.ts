import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { PlanActor } from '../../domain/plan-change.types';

export class DeleteTaskCommand extends CommandBase {
  readonly scope: AccessScope;
  /** Who is acting: the caller, or an agent for them. */
  readonly actor: PlanActor;
  /** The version the caller read (`If-Match`); null deletes whatever is there. */
  readonly expectedVersion: number | null;
  readonly taskId: string;

  constructor(props: CommandProps<DeleteTaskCommand>) {
    super(props);
    this.scope = props.scope;
    this.actor = props.actor;
    this.expectedVersion = props.expectedVersion;
    this.taskId = props.taskId;
  }
}

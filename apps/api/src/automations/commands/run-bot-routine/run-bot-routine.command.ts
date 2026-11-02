import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

/** Run now, from a bot's Routines tab or its own tool: one run of that bot's routine. */
export class RunBotRoutineCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly routineId: string;
  /** The caller's `Idempotency-Key`: a retried Run now is the same run. */
  readonly idempotencyKey: string | null;

  constructor(props: CommandProps<RunBotRoutineCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.routineId = props.routineId;
    this.idempotencyKey = props.idempotencyKey;
  }
}

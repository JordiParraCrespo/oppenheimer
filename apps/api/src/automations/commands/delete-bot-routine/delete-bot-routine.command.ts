import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

/** Delete one of a bot's routines, from its Routines tab or its own tool. */
export class DeleteBotRoutineCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly routineId: string;

  constructor(props: CommandProps<DeleteBotRoutineCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.routineId = props.routineId;
  }
}

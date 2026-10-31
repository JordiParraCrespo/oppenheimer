import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import type { SessionCommandResult } from '../../domain/session-command.types';

/** The watch made, beside what the host could not take just now. */
export interface WatchSessionTerminalResult extends SessionCommandResult {
  watchId: string;
}

/** Watch a live session's screen for a pattern; answers the watch's id. Dispatched by other modules (a bot's subscription), not a route. */
export class WatchSessionTerminalCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly sessionId: string;
  readonly pattern: string;

  constructor(props: CommandProps<WatchSessionTerminalCommand>) {
    super(props);
    this.scope = props.scope;
    this.sessionId = props.sessionId;
    this.pattern = props.pattern;
  }
}

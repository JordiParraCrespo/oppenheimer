import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class RevokeSessionCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly userId: string;
  readonly sessionId: string;
  /** The session this request was made with, so it cannot revoke itself. */
  readonly currentSessionId: string | null;

  constructor(props: CommandProps<RevokeSessionCommand>) {
    super(props);
    this.headers = props.headers;
    this.userId = props.userId;
    this.sessionId = props.sessionId;
    this.currentSessionId = props.currentSessionId;
  }
}

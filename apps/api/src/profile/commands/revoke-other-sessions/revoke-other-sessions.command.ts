import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class RevokeOtherSessionsCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly userId: string;
  /** The session making the request, which survives. */
  readonly sessionId: string | undefined;

  constructor(props: CommandProps<RevokeOtherSessionsCommand>) {
    super(props);
    this.headers = props.headers;
    this.userId = props.userId;
    this.sessionId = props.sessionId;
  }
}

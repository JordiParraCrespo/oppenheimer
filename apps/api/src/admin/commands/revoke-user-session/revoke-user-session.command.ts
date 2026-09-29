import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class RevokeUserSessionCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly userId: string;
  readonly sessionId: string;

  constructor(props: CommandProps<RevokeUserSessionCommand>) {
    super(props);
    this.headers = props.headers;
    this.userId = props.userId;
    this.sessionId = props.sessionId;
  }
}

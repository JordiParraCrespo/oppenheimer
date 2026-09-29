import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class RevokeUserSessionsCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly userId: string;

  constructor(props: CommandProps<RevokeUserSessionsCommand>) {
    super(props);
    this.headers = props.headers;
    this.userId = props.userId;
  }
}

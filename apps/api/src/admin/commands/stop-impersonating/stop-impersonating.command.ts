import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class StopImpersonatingCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;

  constructor(props: CommandProps<StopImpersonatingCommand>) {
    super(props);
    this.headers = props.headers;
  }
}

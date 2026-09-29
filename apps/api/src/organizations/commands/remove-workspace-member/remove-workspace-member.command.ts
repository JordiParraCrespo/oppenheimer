import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class RemoveWorkspaceMemberCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly workspaceId: string;
  readonly userId: string;

  constructor(props: CommandProps<RemoveWorkspaceMemberCommand>) {
    super(props);
    this.headers = props.headers;
    this.workspaceId = props.workspaceId;
    this.userId = props.userId;
  }
}

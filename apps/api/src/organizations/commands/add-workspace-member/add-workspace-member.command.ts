import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class AddWorkspaceMemberCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly workspaceId: string;
  readonly userId: string;

  constructor(props: CommandProps<AddWorkspaceMemberCommand>) {
    super(props);
    this.headers = props.headers;
    this.workspaceId = props.workspaceId;
    this.userId = props.userId;
  }
}

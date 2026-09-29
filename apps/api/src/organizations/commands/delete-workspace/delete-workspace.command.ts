import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class DeleteWorkspaceCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly workspaceId: string;

  constructor(props: CommandProps<DeleteWorkspaceCommand>) {
    super(props);
    this.headers = props.headers;
    this.workspaceId = props.workspaceId;
  }
}

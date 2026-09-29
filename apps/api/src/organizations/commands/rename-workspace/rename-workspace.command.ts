import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class RenameWorkspaceCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly workspaceId: string;
  readonly name: string;

  constructor(props: CommandProps<RenameWorkspaceCommand>) {
    super(props);
    this.headers = props.headers;
    this.workspaceId = props.workspaceId;
    this.name = props.name;
  }
}

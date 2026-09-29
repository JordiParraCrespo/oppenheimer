import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class CreateWorkspaceCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly name: string;
  readonly organizationId: string | undefined;

  constructor(props: CommandProps<CreateWorkspaceCommand>) {
    super(props);
    this.headers = props.headers;
    this.name = props.name;
    this.organizationId = props.organizationId;
  }
}

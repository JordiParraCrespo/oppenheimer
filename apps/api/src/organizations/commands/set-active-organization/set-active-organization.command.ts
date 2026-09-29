import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class SetActiveOrganizationCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly organizationId: string;

  constructor(props: CommandProps<SetActiveOrganizationCommand>) {
    super(props);
    this.headers = props.headers;
    this.organizationId = props.organizationId;
  }
}

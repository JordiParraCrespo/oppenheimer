import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class RemoveMemberCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly organizationId: string;
  readonly memberIdOrEmail: string;

  constructor(props: CommandProps<RemoveMemberCommand>) {
    super(props);
    this.headers = props.headers;
    this.organizationId = props.organizationId;
    this.memberIdOrEmail = props.memberIdOrEmail;
  }
}

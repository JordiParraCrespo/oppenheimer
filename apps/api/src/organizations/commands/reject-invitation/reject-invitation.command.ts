import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class RejectInvitationCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly invitationId: string;

  constructor(props: CommandProps<RejectInvitationCommand>) {
    super(props);
    this.headers = props.headers;
    this.invitationId = props.invitationId;
  }
}

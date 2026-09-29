import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { InvitationCaller } from '../../domain/invitation.types';

export class AcceptInvitationCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly invitationId: string;
  readonly caller: InvitationCaller | null;

  constructor(props: CommandProps<AcceptInvitationCommand>) {
    super(props);
    this.headers = props.headers;
    this.invitationId = props.invitationId;
    this.caller = props.caller;
  }
}

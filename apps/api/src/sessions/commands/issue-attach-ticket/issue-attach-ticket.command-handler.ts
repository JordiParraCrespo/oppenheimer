import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import {
  AttachTicketFactory,
  type IssuedAttachTicket,
} from '../../application/attach-ticket.factory';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import { IssueAttachTicketCommand } from './issue-attach-ticket.command';

/**
 * Mints a single-use ticket for one window of one session (`AttachTicketFactory`
 * says how it travels and why it lives sixty seconds).
 *
 * Authorization is not frozen at mint: the consumer re-checks that the session is live
 * and the person is still a workspace member who may use its host, or stopping the
 * session or revoking access inside the window would still get them a PTY. The host
 * is checked here too, so a caller who lost it gets the 404 rather than a ticket.
 */
@CommandHandler(IssueAttachTicketCommand)
export class IssueAttachTicketCommandHandler
  implements ICommandHandler<IssueAttachTicketCommand, IssuedAttachTicket>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
    private readonly tickets: AttachTicketFactory,
  ) {}

  async execute(command: IssueAttachTicketCommand): Promise<IssuedAttachTicket> {
    const session = await this.loader.requireLive(command.scope, command.sessionId);
    // The session being yours is not the machine being yours to use: a grant
    // revoked, or a host unpaired, since the session was created ends the PTY.
    await this.hosts.assertUsable(command.scope, session.hostId);

    return this.tickets.issue({
      sessionId: session.id,
      organizationId: session.organizationId,
      window: command.window,
      userId: command.userId,
    });
  }
}

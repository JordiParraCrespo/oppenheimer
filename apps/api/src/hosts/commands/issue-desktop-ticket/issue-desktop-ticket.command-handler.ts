import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import {
  DesktopTicketFactory,
  type IssuedDesktopTicket,
} from '../../application/desktop-ticket.factory';
import type { HostAccessPort } from '../../application/host-access.port';
import { HostErrors } from '../../domain/hosts.errors';
import { HOST_ACCESS } from '../../hosts.di-tokens';
import { IssueDesktopTicketCommand } from './issue-desktop-ticket.command';

/**
 * Mints a single-use ticket for one host's desktop, for a caller who may use
 * the host: the same own-or-granted rule a session on it asks. Whether the
 * host shares its desktop at all is not asked here: it is the host owner's
 * call, made on the host (`runner desktop on`), and the runner answers it on
 * the socket.
 *
 * Authorization is not frozen at mint: the relay judges the ticket again at
 * redemption and every minute after, so a host unpaired or a grant revoked
 * ends a desktop already streaming.
 */
@CommandHandler(IssueDesktopTicketCommand)
export class IssueDesktopTicketCommandHandler
  implements ICommandHandler<IssueDesktopTicketCommand, IssuedDesktopTicket>
{
  constructor(
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
    private readonly tickets: DesktopTicketFactory,
  ) {}

  async execute(command: IssueDesktopTicketCommand): Promise<IssuedDesktopTicket> {
    const { scope, hostId } = command;
    // A desktop is judged in a workspace, as a terminal is; a caller acting
    // with none has nowhere to be a member of.
    if (!scope.organizationId) throw new AppError(HostErrors.NOT_FOUND);
    await this.hosts.assertUsable(scope, hostId);
    return this.tickets.issue({
      hostId,
      organizationId: scope.organizationId,
      userId: scope.userId,
    });
  }
}

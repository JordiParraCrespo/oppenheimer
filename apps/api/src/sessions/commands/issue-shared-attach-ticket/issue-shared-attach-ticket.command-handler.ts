import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  AttachTicketFactory,
  type IssuedAttachTicket,
} from '../../application/attach-ticket.factory';
import { SessionShareAccessResolver } from '../../application/session-share-access.resolver';
import { IssueSharedAttachTicketCommand } from './issue-shared-attach-ticket.command';

/**
 * A share opens the agent's window and nothing else: the guest never names
 * one, so a share cannot reach a shell window someone opened beside it.
 */
const SHARED_WINDOW = 0;

/**
 * A ticket for a guest. The claim names the person who shared the session,
 * so the relay judges it the way it judges theirs — still a member, still
 * active, the host still theirs to use — and names the share and the guest,
 * so the relay also checks the share still opens for them with this access
 * and, for `read`, drops input. All of it again every minute while the
 * terminal is open.
 */
@CommandHandler(IssueSharedAttachTicketCommand)
export class IssueSharedAttachTicketCommandHandler
  implements ICommandHandler<IssueSharedAttachTicketCommand, IssuedAttachTicket>
{
  constructor(
    private readonly access: SessionShareAccessResolver,
    private readonly tickets: AttachTicketFactory,
  ) {}

  async execute(command: IssueSharedAttachTicketCommand): Promise<IssuedAttachTicket> {
    const { share, session, viewer } = await this.access.open(command.slug, command.viewer);
    return this.tickets.issue({
      sessionId: session.id,
      organizationId: session.organizationId,
      window: SHARED_WINDOW,
      userId: share.sharedByUserId,
      share: {
        shareId: share.id,
        readOnly: share.readOnly,
        viewerUserId: viewer.userId,
      },
    });
  }
}

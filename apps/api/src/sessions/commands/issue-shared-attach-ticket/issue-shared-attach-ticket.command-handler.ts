import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  AttachTicketFactory,
  type IssuedAttachTicket,
} from '../../application/attach-ticket.factory';
import { ShareLinkAccessResolver } from '../../application/share-link-access.resolver';
import { IssueSharedAttachTicketCommand } from './issue-shared-attach-ticket.command';

/**
 * A link opens the agent's window and nothing else: the holder never names
 * one, so a link cannot reach a shell window someone opened beside it.
 */
const SHARED_WINDOW = 0;

/**
 * A ticket for a share link's holder. The claim names the link's creator as
 * the person, so the relay judges it the way it judges theirs — still a
 * member, still active, the host still theirs to use — and names the link,
 * so the relay also checks it is still live and, for `read`, drops input.
 * All of it again every minute while the terminal is open.
 */
@CommandHandler(IssueSharedAttachTicketCommand)
export class IssueSharedAttachTicketCommandHandler
  implements ICommandHandler<IssueSharedAttachTicketCommand, IssuedAttachTicket>
{
  constructor(
    private readonly access: ShareLinkAccessResolver,
    private readonly tickets: AttachTicketFactory,
  ) {}

  async execute(command: IssueSharedAttachTicketCommand): Promise<IssuedAttachTicket> {
    const { link, session } = await this.access.open(command.token, command.viewer);
    return this.tickets.issue({
      sessionId: session.id,
      organizationId: session.organizationId,
      window: SHARED_WINDOW,
      userId: link.createdByUserId,
      share: {
        linkId: link.id,
        readOnly: link.readOnly,
        viewerUserId: command.viewer?.userId ?? null,
      },
    });
  }
}

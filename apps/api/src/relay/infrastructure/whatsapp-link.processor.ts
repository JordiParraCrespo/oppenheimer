import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { WhatsappMessagesMessage, WhatsappStateMessage } from '@oppenheimer/shared/protocol';
import type { RunnerLink } from '../../links/application/link-registry.port';
import { ReceiveWhatsappMessagesCommand } from '../../whatsapp/commands/receive-whatsapp-messages/receive-whatsapp-messages.command';
import { RecordWhatsappStateCommand } from '../../whatsapp/commands/record-whatsapp-state/record-whatsapp-state.command';

/**
 * A host's WhatsApp device on its link (`product/next-steps/whatsapp.md` §2):
 * its state and the messages it saw, handed to the `whatsapp` module. The
 * link is the host's authentication, so the host is the link's, never one a
 * frame names. Messages are acknowledged only once stored, so a link that
 * drops first has the runner send them again.
 */
@Injectable()
export class WhatsappLinkProcessor {
  constructor(private readonly commandBus: CommandBus) {}

  async onState(link: RunnerLink, message: WhatsappStateMessage): Promise<void> {
    await this.commandBus.execute(
      new RecordWhatsappStateCommand({ hostId: link.hostId, report: message }),
    );
  }

  async onMessages(link: RunnerLink, message: WhatsappMessagesMessage): Promise<void> {
    const keys = await this.commandBus.execute<ReceiveWhatsappMessagesCommand, string[]>(
      new ReceiveWhatsappMessagesCommand({ hostId: link.hostId, messages: message.messages }),
    );
    if (keys.length > 0) link.send({ type: 'whatsapp.ack', keys });
  }
}

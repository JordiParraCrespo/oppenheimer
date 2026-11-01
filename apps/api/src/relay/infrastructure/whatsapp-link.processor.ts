import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { WhatsappMessagesMessage, WhatsappStateMessage } from '@oppenheimer/shared/protocol';
import type { RunnerLink } from '../../links/application/link-registry.port';
import { ReceiveWhatsappMessagesCommand } from '../../whatsapp/commands/receive-whatsapp-messages/receive-whatsapp-messages.command';
import { RecordWhatsappStateCommand } from '../../whatsapp/commands/record-whatsapp-state/record-whatsapp-state.command';

/**
 * Intake frames one link may have waiting behind the one being stored. Past
 * this a frame is dropped unacknowledged, and the runner, which keeps every
 * message until it is acked, offers it again a minute later.
 */
export const WHATSAPP_INTAKE_QUEUE_MAX = 4;

/**
 * Messages one host's link may hand over in a minute. A personal number sees
 * far fewer; a runner past it is flooding, and its frames wait unacked on the
 * host until the window has room.
 */
export const WHATSAPP_INTAKE_PER_MINUTE = 600;

const MINUTE_MS = 60_000;

interface LinkIntake {
  tail: Promise<void>;
  waiting: number;
  /** When each message of the last minute was taken, oldest first. */
  taken: number[];
}

/**
 * A host's WhatsApp device on its link (`product/next-steps/whatsapp.md` §2):
 * its state and the messages it saw, handed to the `whatsapp` module. The
 * link is the host's authentication, so the host is the link's, never one a
 * frame names. Messages are acknowledged only once stored, so a link that
 * drops first has the runner send them again.
 *
 * Intake is the one frame a runner can make the database grow with, so it is
 * bounded per link the way `events.append` is (`LinkAppendQueue`): one frame
 * stored at a time, a short backlog, and a rate per minute. What does not fit
 * is not acked, which costs a well-behaved runner a minute's delay and a
 * flooding one nothing it can turn into storage.
 */
@Injectable()
export class WhatsappLinkProcessor {
  private readonly logger = new Logger(WhatsappLinkProcessor.name);
  private readonly intakes = new WeakMap<RunnerLink, LinkIntake>();

  constructor(private readonly commandBus: CommandBus) {}

  async onState(link: RunnerLink, message: WhatsappStateMessage): Promise<void> {
    await this.commandBus.execute(
      new RecordWhatsappStateCommand({ hostId: link.hostId, report: message }),
    );
  }

  onMessages(link: RunnerLink, message: WhatsappMessagesMessage, now = Date.now()): Promise<void> {
    const intake = this.intakeOf(link);
    if (intake.waiting >= WHATSAPP_INTAKE_QUEUE_MAX || !this.admit(intake, message, now)) {
      this.logger.warn({
        message: 'WhatsApp intake over its bound; the frame waits on the host',
        hostId: link.hostId,
        messages: message.messages.length,
      });
      return Promise.resolve();
    }
    intake.waiting += 1;
    const run = intake.tail.then(() => this.store(link, message));
    intake.tail = run
      .catch(() => {})
      .finally(() => {
        intake.waiting -= 1;
      });
    return run;
  }

  private async store(link: RunnerLink, message: WhatsappMessagesMessage): Promise<void> {
    const keys = await this.commandBus.execute<ReceiveWhatsappMessagesCommand, string[]>(
      new ReceiveWhatsappMessagesCommand({ hostId: link.hostId, messages: message.messages }),
    );
    if (keys.length > 0) link.send({ type: 'whatsapp.ack', keys });
  }

  /** Takes the frame's messages from the minute's allowance, or none of them. */
  private admit(intake: LinkIntake, message: WhatsappMessagesMessage, now: number): boolean {
    while (intake.taken.length > 0 && (intake.taken[0] ?? now) <= now - MINUTE_MS) {
      intake.taken.shift();
    }
    if (intake.taken.length + message.messages.length > WHATSAPP_INTAKE_PER_MINUTE) return false;
    for (const _ of message.messages) intake.taken.push(now);
    return true;
  }

  private intakeOf(link: RunnerLink): LinkIntake {
    let intake = this.intakes.get(link);
    if (!intake) {
      intake = { tail: Promise.resolve(), waiting: 0, taken: [] };
      this.intakes.set(link, intake);
    }
    return intake;
  }
}

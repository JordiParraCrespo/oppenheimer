import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { WhatsappInbound } from '@oppenheimer/shared/protocol';

/** A host's `whatsapp.messages`, as its link received them. The relay dispatches it. */
export class ReceiveWhatsappMessagesCommand extends CommandBase {
  readonly hostId: string;
  readonly messages: readonly WhatsappInbound[];

  constructor(props: CommandProps<ReceiveWhatsappMessagesCommand>) {
    super(props);
    this.hostId = props.hostId;
    this.messages = props.messages;
  }
}

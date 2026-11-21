import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { WhatsappKnownChat } from '@oppenheimer/shared/protocol';

/** A host's `whatsapp.chats`, as its link received it. The relay dispatches it. */
export class RecordWhatsappChatsCommand extends CommandBase {
  readonly hostId: string;
  readonly chats: WhatsappKnownChat[];

  constructor(props: CommandProps<RecordWhatsappChatsCommand>) {
    super(props);
    this.hostId = props.hostId;
    this.chats = props.chats;
  }
}

import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { TelegramInbound } from '@oppenheimer/shared/protocol';

/** A host's `telegram.messages`, as its link received them. The relay dispatches it. */
export class ReceiveTelegramMessagesCommand extends CommandBase {
  readonly hostId: string;
  readonly messages: readonly TelegramInbound[];

  constructor(props: CommandProps<ReceiveTelegramMessagesCommand>) {
    super(props);
    this.hostId = props.hostId;
    this.messages = props.messages;
  }
}

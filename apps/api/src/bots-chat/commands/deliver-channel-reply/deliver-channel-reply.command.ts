import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * Send a channel turn's answer (Telegram, WhatsApp) to the chat its message
 * came from (`product/next-steps/answering-on-telegram-and-whatsapp.md`);
 * dispatched by the `bot-turns` worker from the job the end of the turn staged.
 */
export class DeliverChannelReplyCommand extends CommandBase {
  /** The channel turn, ended. */
  readonly turnId: string;

  constructor(props: CommandProps<DeliverChannelReplyCommand>) {
    super(props);
    this.turnId = props.turnId;
  }
}

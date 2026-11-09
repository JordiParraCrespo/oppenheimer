import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * Send a Telegram turn's answer to the chat its message came from
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md`); dispatched by
 * the `bot-turns` worker from the job the end of the turn staged.
 */
export class DeliverTelegramReplyCommand extends CommandBase {
  /** The Telegram turn, ended. */
  readonly turnId: string;

  constructor(props: CommandProps<DeliverTelegramReplyCommand>) {
    super(props);
    this.turnId = props.turnId;
  }
}

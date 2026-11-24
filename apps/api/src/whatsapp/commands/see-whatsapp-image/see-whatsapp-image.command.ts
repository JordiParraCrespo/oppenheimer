import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * Fetch an image a linked number received, for a bot to see: the turn a
 * WhatsApp image queued dispatches it when it starts. Answers the image's
 * bytes, or why it could not be seen (`WhatsappImageSight`).
 */
export class SeeWhatsappImageCommand extends CommandBase {
  readonly organizationId: string;
  readonly accountId: string;
  /** The stored `whatsapp_message` row of the image. */
  readonly messageRowId: string;

  constructor(props: CommandProps<SeeWhatsappImageCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.accountId = props.accountId;
    this.messageRowId = props.messageRowId;
  }
}

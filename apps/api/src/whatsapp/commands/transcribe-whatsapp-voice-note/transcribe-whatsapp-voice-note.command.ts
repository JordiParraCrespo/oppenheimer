import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * Hear a voice note a linked number received: what wakes the owner's bot on
 * one dispatches it first. Answers the note as the bot reads it: its words, or
 * why they could not be heard.
 */
export class TranscribeWhatsappVoiceNoteCommand extends CommandBase {
  readonly organizationId: string;
  readonly accountId: string;
  /** The stored `whatsapp_message` row of the voice note. */
  readonly messageRowId: string;

  constructor(props: CommandProps<TranscribeWhatsappVoiceNoteCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.accountId = props.accountId;
    this.messageRowId = props.messageRowId;
  }
}

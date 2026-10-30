import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { WhatsappStateMessage } from '@oppenheimer/shared/protocol';

/** A host's `whatsapp.state`, as its link received it. The relay dispatches it. */
export class RecordWhatsappStateCommand extends CommandBase {
  readonly hostId: string;
  readonly report: WhatsappStateMessage;

  constructor(props: CommandProps<RecordWhatsappStateCommand>) {
    super(props);
    this.hostId = props.hostId;
    this.report = props.report;
  }
}

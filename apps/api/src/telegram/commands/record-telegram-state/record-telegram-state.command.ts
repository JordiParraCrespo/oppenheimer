import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { TelegramStateMessage } from '@oppenheimer/shared/protocol';

/** A host's `telegram.state`, as its link received it. The relay dispatches it. */
export class RecordTelegramStateCommand extends CommandBase {
  readonly hostId: string;
  readonly report: TelegramStateMessage;

  constructor(props: CommandProps<RecordTelegramStateCommand>) {
    super(props);
    this.hostId = props.hostId;
    this.report = props.report;
  }
}

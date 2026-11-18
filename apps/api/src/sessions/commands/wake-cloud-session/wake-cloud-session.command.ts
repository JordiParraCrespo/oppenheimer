import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { CloudReplyWake } from '../../database/session-cloud-chat.repository.port';

export class WakeCloudSessionCommand extends CommandBase {
  readonly wake: CloudReplyWake;

  constructor(props: CommandProps<WakeCloudSessionCommand>) {
    super(props);
    this.wake = props.wake;
  }
}

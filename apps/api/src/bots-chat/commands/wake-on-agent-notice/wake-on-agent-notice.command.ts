import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** A session a bot follows had its agent send a line (`SessionAgentNotifiedDomainEvent`). */
export class WakeOnAgentNoticeCommand extends CommandBase {
  readonly subscriptionId: string;
  /** The runner's id for the notice the event named. */
  readonly noticeId: string;

  constructor(props: CommandProps<WakeOnAgentNoticeCommand>) {
    super(props);
    this.subscriptionId = props.subscriptionId;
    this.noticeId = props.noticeId;
  }
}

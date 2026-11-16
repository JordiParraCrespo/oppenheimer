import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * Wake a bot for a session it follows, if the session's task now calls for
 * it; dispatched for each subscription to a
 * session whose task changed state.
 */
export class WakeSubscribedBotCommand extends CommandBase {
  readonly subscriptionId: string;

  constructor(props: CommandProps<WakeSubscribedBotCommand>) {
    super(props);
    this.subscriptionId = props.subscriptionId;
  }
}

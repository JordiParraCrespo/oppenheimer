import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { TaskActivityFields } from '../../domain/bot-task-wake.policy';

/**
 * Wake a bot for a change to a task on a project or milestone it follows
 * (`27-bot-subscriptions.md` §7.2); dispatched for each subscription to the
 * task's project or milestone. It carries the change as Plan logged it.
 */
export class WakeOnTaskActivityCommand extends CommandBase {
  readonly subscriptionId: string;
  readonly change: TaskActivityFields;

  constructor(props: CommandProps<WakeOnTaskActivityCommand>) {
    super(props);
    this.subscriptionId = props.subscriptionId;
    this.change = props.change;
  }
}

import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * Check, a few minutes after a bot handed a session a task, that the task got
 * going (`27-bot-subscriptions.md` §4.1); dispatched by the `bot-stall-checks`
 * worker for the subscription and the task it followed.
 */
export class CheckStalledSessionCommand extends CommandBase {
  readonly subscriptionId: string;
  /** The task checked: the one the bot handed off. */
  readonly turn: number;
  /** Which check of the task, from 1: the first is the stall check, the rest look at progress (§4.2). */
  readonly check: number;

  constructor(props: CommandProps<CheckStalledSessionCommand>) {
    super(props);
    this.subscriptionId = props.subscriptionId;
    this.turn = props.turn;
    this.check = props.check;
  }
}

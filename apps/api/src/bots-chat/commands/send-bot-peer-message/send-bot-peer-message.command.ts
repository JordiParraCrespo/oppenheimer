import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

/**
 * A bot's `message_bot` or `ask_bot` call (`25-bots.md` §4.6): queue a turn
 * on another bot of the owner's, opened by the message. Dispatched by the
 * tool alone; the sender is the turn that made the call, never a name the
 * call gives.
 */
export class SendBotPeerMessageCommand extends CommandBase {
  /** The bots' owner's scope, which the receiving bot is read through. */
  readonly owner: AccessScope;
  readonly organizationId: string;
  /** The turn that made the call, and its bot. */
  readonly fromTurnId: string;
  readonly fromBotId: string;
  readonly toBotId: string;
  readonly content: string;
  /** `ask_bot`: the receiving turn's answer is queued back on the sender. */
  readonly expectsReply: boolean;

  constructor(props: CommandProps<SendBotPeerMessageCommand>) {
    super(props);
    this.owner = props.owner;
    this.organizationId = props.organizationId;
    this.fromTurnId = props.fromTurnId;
    this.fromBotId = props.fromBotId;
    this.toBotId = props.toBotId;
    this.content = props.content;
    this.expectsReply = props.expectsReply;
  }
}

/** The turn queued on the receiving bot, or why nothing was sent, in words for the sending bot. */
export type SendBotPeerMessageResult =
  | { sent: true; turnId: string; botName: string }
  | { sent: false; refusal: string };

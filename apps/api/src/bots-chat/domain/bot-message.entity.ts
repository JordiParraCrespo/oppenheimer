import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { BOT_MESSAGE_ROLES, type BotMessageEvent, type BotMessageRole } from '@oppenheimer/shared';

/** One tool call in an activity line, as the chat opens it to. */
export interface BotToolStep {
  callId: string;
  name: string;
  /** The call's input as the model sent it. */
  input: unknown;
  /** What it answered, cut to `BOT_TOOL_OUTPUT_MAX`; null while it runs. */
  output: string | null;
  isError: boolean;
  /** The session the call started (`start_session`), for the chat to open; null for any other. */
  sessionId: string | null;
}

/** How much of a tool's answer a message keeps: enough to read, never a whole page. */
export const BOT_TOOL_OUTPUT_MAX = 2_000;

export interface BotMessageProps {
  organizationId: string;
  botId: string;
  /**
   * The turn it belongs to; null only for an event that happened outside any
   * turn, such as a routine changed on its tab (`26-bot-routines.md` §4).
   */
  turnId: string | null;
  role: BotMessageRole;
  /** The text: yours, or the bot's. Empty for an activity line. */
  content: string;
  /** An activity line's calls, in the order they ran; empty otherwise. */
  steps: BotToolStep[];
  /** Its place in its turn, from 0. */
  position: number;
  /** What an event says happened, for the chat; an event has one, nothing else does. */
  event?: BotMessageEvent | null;
}

/** One thing the chat draws (`25-bots.md` §3). */
export class BotMessageEntity extends AggregateRoot<BotMessageProps> {
  static create(create: CreateEntityProps<BotMessageProps>): BotMessageEntity {
    return new BotMessageEntity(create);
  }

  static createNew(props: BotMessageProps): BotMessageEntity {
    const message = new BotMessageEntity({ id: randomUUID(), props });
    message.validate();
    return message;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get botId(): string {
    return this.props.botId;
  }
  get turnId(): string | null {
    return this.props.turnId;
  }
  get role(): BotMessageRole {
    return this.props.role;
  }
  get content(): string {
    return this.props.content;
  }
  get steps(): BotToolStep[] {
    return this.props.steps;
  }
  get position(): number {
    return this.props.position;
  }
  get event(): BotMessageEvent | null {
    return this.props.event ?? null;
  }

  public validate(): void {
    const { props } = this;
    if (!props.organizationId || !props.botId) {
      throw new ArgumentNotProvidedException('A message belongs to a bot');
    }
    if (!props.turnId && props.role !== 'event') {
      throw new ArgumentNotProvidedException('Only an event stands outside a turn');
    }
    if (!BOT_MESSAGE_ROLES.includes(props.role)) {
      throw new ArgumentInvalidException(`${props.role} is not a message role`);
    }
    if ((props.role === 'event') !== Boolean(props.event)) {
      throw new ArgumentInvalidException('An event says what happened, and only an event does');
    }
    if (props.role !== 'activity' && !props.content) {
      throw new ArgumentInvalidException('A message says something');
    }
  }
}

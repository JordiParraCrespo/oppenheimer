import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';
import type { SlackImage } from '../slack-inbound.policy';

/**
 * The owner of a bot's Slack app asked it something, by a mention in a channel
 * or in its DM: raised once per message Slack delivered, in the transaction
 * that verified it. `command` is what it asks: a turn (`message`), or the
 * thread's running turn to stop (`stop`). The aggregate is the Slack app.
 */
export class SlackOwnerWroteDomainEvent extends DomainEvent {
  readonly organizationId: string;
  /** The bot's maker, whose Slack user asked: the turn is theirs. */
  readonly userId: string;
  /** The Oppenheimer bot the app is. */
  readonly botId: string;
  /** The channel it was asked in. */
  readonly channel: string;
  /** The thread the answer goes in, as the conversation's chat: `<channel>:<thread ts>`. */
  readonly chatId: string;
  /** Slack's timestamp of the message, unique in its channel. */
  readonly ts: string;
  /** The timestamp as a position in the channel, digits only (`slackTsPosition`). */
  readonly position: string;
  readonly command: 'message' | 'stop';
  /** What they wrote, as plain words; empty for `stop`. */
  readonly text: string;
  /** The images the message carries, fetched when the turn is queued. */
  readonly images: SlackImage[];
  /** The files it carries that no bot reads (not an image, too large, past the limit). */
  readonly skippedFiles: number;

  constructor(props: DomainEventProps<SlackOwnerWroteDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.userId = props.userId;
    this.botId = props.botId;
    this.channel = props.channel;
    this.chatId = props.chatId;
    this.ts = props.ts;
    this.position = props.position;
    this.command = props.command;
    this.text = props.text;
    this.images = props.images;
    this.skippedFiles = props.skippedFiles;
  }
}

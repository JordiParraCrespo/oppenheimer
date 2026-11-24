import { type ChannelTurnProps, channelTurn } from './bot-channel-turn.policy';
import type { BotMessageEntity } from './bot-message.entity';
import type { BotTurnEntity } from './bot-turn.entity';

/** What a message of the owner's on Slack is, for the turn it queues. */
export interface BotSlackMessage {
  /** The conversation the Slack thread is with the bot. */
  conversationId: string;
  /** The bot's Slack app it came through, the channel, and the message's timestamp there. */
  slackAccountId: string;
  channel: string;
  ts: string;
  text: string;
}

/**
 * The key that makes a Slack message one turn however often Slack delivers it
 * (a retry, or a mention in the app's DM that is also a DM message): its app,
 * channel and timestamp.
 */
export function slackSourceKey(
  message: Pick<BotSlackMessage, 'slackAccountId' | 'channel' | 'ts'>,
): string {
  return `slack:${message.slackAccountId}:${message.channel}:${message.ts}`;
}

/** The Slack timestamp of the message a turn's key names (`slackSourceKey`), or null for any other key. */
export function slackTsOf(sourceKey: string | null): string | null {
  const match = /^slack:[0-9a-f-]{36}:[A-Z0-9]{1,32}:(\d{1,12}\.\d{6})$/.exec(sourceKey ?? '');
  return match?.[1] ?? null;
}

/** The turn the owner's message on Slack queues, in its thread's conversation. */
export function slackTurn(
  props: ChannelTurnProps,
  message: BotSlackMessage,
): { turn: BotTurnEntity; opening: BotMessageEntity } {
  return channelTurn(props, {
    origin: 'slack',
    sourceKey: slackSourceKey(message),
    conversationId: message.conversationId,
    text: message.text,
  });
}

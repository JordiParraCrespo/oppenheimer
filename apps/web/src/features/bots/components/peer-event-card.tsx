import { BotExchange, BotExchangeTurn } from '@oppenheimer/design-system-web';
import type { BotPeerMessageEvent, BotPeerReplyEvent } from '@oppenheimer/shared/schemas/bot';
import { Trans } from 'react-i18next';

function leadKey(event: BotPeerMessageEvent | BotPeerReplyEvent) {
  if (event.kind === 'bot_message') {
    return event.expectsReply ? 'bots.chat.event.peerAsk' : 'bots.chat.event.peerMessage';
  }
  if (event.outcome === 'answered') return 'bots.chat.event.peerAnswered';
  return event.outcome === 'failed'
    ? 'bots.chat.event.peerFailed'
    : 'bots.chat.event.peerCancelled';
}

/**
 * Another bot's message, or its answer to one this bot asked
 * (`25-bots.md` §4.6), as a `BotExchange` card naming the bot Oppenheimer
 * recorded as the sender, with what it said.
 */
export function PeerEventCard({
  event,
  messageId,
  content,
}: {
  event: BotPeerMessageEvent | BotPeerReplyEvent;
  messageId: string;
  content: string;
}) {
  return (
    <BotExchange data-message-id={messageId}>
      <BotExchangeTurn
        direction="in"
        reply={event.kind === 'bot_reply'}
        lead={
          <Trans
            i18nKey={leadKey(event)}
            values={{ name: event.fromBotName }}
            components={{ bot: <strong /> }}
          />
        }
      >
        <span className="whitespace-pre-wrap">{content}</span>
      </BotExchangeTurn>
    </BotExchange>
  );
}

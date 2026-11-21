import { BotExchange, BotExchangeFoldTurn, BotExchangeTurn } from '@oppenheimer/design-system-web';
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
 * Another bot's message, or its answer to one this bot asked, as a
 * `BotExchange` card naming the bot Oppenheimer recorded as the sender,
 * with what it said. An answer comes back folded to its lead ("Oppie
 * replied"): it can run long, and the bot's own reply under it says what it
 * took from it; the person opens it when they want the words.
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
  const Turn = event.kind === 'bot_reply' ? BotExchangeFoldTurn : BotExchangeTurn;
  return (
    <BotExchange data-message-id={messageId}>
      <Turn
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
      </Turn>
    </BotExchange>
  );
}

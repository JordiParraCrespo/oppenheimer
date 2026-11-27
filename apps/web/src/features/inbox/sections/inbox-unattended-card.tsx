import {
  Button,
  InboxMessage,
  InboxMessageActions,
  InboxMessageBody,
} from '@oppenheimer/design-system-web';
import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InboxKindIcon } from '@/features/inbox/components/inbox-kind-icon';
import { useSessionChatSlot } from '@/features/inbox/hooks/use-session-chat-slot';
import type { InboxCopy } from '@/features/inbox/lib/inbox-copy';
import { inboxHeld } from '@/features/inbox/lib/inbox-held';

/**
 * A session whose turn ended thirty minutes ago and that nobody has opened
 * since, with two ways to move it forward. Reply here opens the session on
 * the card, streamed as its own page draws it (its chat and its terminal),
 * without reading its turn, so you see what it did and answer it without
 * leaving the Inbox. While it is open the card holds the deck
 * (`inboxHeld`): the session going back to work takes it off the list, not
 * from under your hands; closing the reply, Done or moving on lets go. Open
 * session goes to its page, which reads the turn. The dock's Done puts it
 * away without either.
 */
export function InboxUnattendedCard({
  item,
  copy,
  from,
  age,
}: {
  item: Extract<InboxItem, { kind: 'unattended' }>;
  copy: InboxCopy;
  from: string;
  age: string;
}) {
  const { t } = useTranslation();
  const session = useSessionChatSlot();
  const [replying, setReplying] = useState(false);
  const sessionId = item.session.id;
  // Synchronises the deck's hold with the open reply: held while open, let
  // go when it closes or the card leaves the deck.
  useEffect(() => {
    if (!replying) return;
    inboxHeld.hold(item);
    return () => inboxHeld.release(item.key);
  }, [replying, item]);
  return (
    <InboxMessage
      icon={<InboxKindIcon kind="unattended" />}
      sender={copy.sender}
      meta={from}
      title={copy.title}
      age={age}
    >
      <InboxMessageBody>{copy.body}</InboxMessageBody>
      <InboxMessageActions>
        {session ? (
          <Button
            variant="secondary"
            aria-expanded={replying}
            aria-controls={`inbox-session-chat-${item.key}`}
            onClick={() => setReplying((open) => !open)}
          >
            {replying ? t('inbox.unattended.hideReply') : t('inbox.unattended.reply')}
          </Button>
        ) : null}
        <Button
          variant="secondary"
          render={<Link to="/sessions/$sessionId" params={{ sessionId }} />}
        >
          {t('inbox.session.open')}
        </Button>
      </InboxMessageActions>
      {session && replying ? (
        <section
          id={`inbox-session-chat-${item.key}`}
          aria-label={t('inbox.unattended.chat', { name: copy.sender })}
          data-swipe-ignore
          className="flex h-120 max-h-[70dvh] flex-col overflow-hidden rounded-lg border border-border-subtle bg-term-bg"
        >
          {session(sessionId)}
        </section>
      ) : null}
    </InboxMessage>
  );
}

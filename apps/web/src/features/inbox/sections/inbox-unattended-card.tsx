import { Button, InboxMessage, InboxMessageBody } from '@oppenheimer/design-system-web';
import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InboxKindIcon } from '@/features/inbox/components/inbox-kind-icon';
import { useInboxHold } from '@/features/inbox/hooks/use-inbox-hold';
import { useInboxSlot } from '@/features/inbox/hooks/use-inbox-slot';
import type { InboxCopy } from '@/features/inbox/lib/inbox-copy';
import { InboxReplyHere } from '@/features/inbox/sections/inbox-reply-here';

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
  const session = useInboxSlot('session');
  const [replying, setReplying] = useState(false);
  const sessionId = item.session.id;
  useInboxHold(item, replying);
  return (
    <InboxMessage
      icon={<InboxKindIcon kind="unattended" />}
      sender={copy.sender}
      meta={from}
      title={copy.title}
      age={age}
    >
      <InboxMessageBody>{copy.body}</InboxMessageBody>
      <InboxReplyHere
        id={`inbox-session-chat-${item.key}`}
        slot={session ? () => session(sessionId) : null}
        open={replying}
        onOpenChange={setReplying}
        labels={{
          reply: t('inbox.unattended.reply'),
          hide: t('inbox.unattended.hideReply'),
          pane: t('inbox.unattended.chat', { name: copy.sender }),
        }}
        link={
          <Button
            variant="secondary"
            render={<Link to="/sessions/$sessionId" params={{ sessionId }} />}
          >
            {t('inbox.session.open')}
          </Button>
        }
        className="overflow-hidden bg-term-bg"
      />
    </InboxMessage>
  );
}

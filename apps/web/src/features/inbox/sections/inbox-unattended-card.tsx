import {
  Button,
  InboxMessage,
  InboxMessageActions,
  InboxMessageBody,
} from '@oppenheimer/design-system-web';
import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InboxKindIcon } from '@/features/inbox/components/inbox-kind-icon';
import { useSessionChatSlot } from '@/features/inbox/hooks/use-session-chat-slot';
import type { InboxCopy } from '@/features/inbox/lib/inbox-copy';

/**
 * A session whose turn ended thirty minutes ago and that nobody has opened
 * since, with two ways to move it forward. Reply here opens the session on
 * the card, streamed as its own page draws it (its chat and its terminal),
 * without reading its turn, so you see what it did and answer it without
 * leaving the Inbox; once it goes back to work it leaves the list. Open
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

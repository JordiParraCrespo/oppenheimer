import { Button, InboxMessage, InboxMessageBody } from '@oppenheimer/design-system-web';
import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { useSendSessionPrompt } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { InboxKindIcon } from '@/features/inbox/components/inbox-kind-icon';
import { SessionReplyForm } from '@/features/inbox/forms/session-reply-form';
import type { InboxCopy } from '@/features/inbox/lib/inbox-copy';
import { inboxVisit } from '@/features/inbox/lib/inbox-visit';

/**
 * A session whose turn ended thirty minutes ago and that nobody has opened
 * since, with two ways to move it forward: a reply written here, typed into
 * the agent's prompt as its chat would (the session goes back to work and
 * leaves the Inbox), or Open session, which reads its turn. The dock's Done
 * puts it away without either. A refused reply (the agent went back to work
 * elsewhere, the host is offline) keeps the text and says why over Send.
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
  const reply = useSendSessionPrompt();
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
      <SessionReplyForm
        id={`inbox-session-reply-${item.key}`}
        pending={reply.isPending}
        onSubmit={({ text }) =>
          reply.mutate({ sessionId, text }, { onSuccess: () => inboxVisit.answered(item.key) })
        }
        alert={
          reply.error ? (
            <ErrorAlert
              error={reply.error}
              fallback={t('inbox.unattended.replyFailed')}
              onDismiss={reply.reset}
            />
          ) : null
        }
        link={
          <Button
            variant="secondary"
            render={<Link to="/sessions/$sessionId" params={{ sessionId }} />}
          >
            {t('inbox.session.open')}
          </Button>
        }
      />
    </InboxMessage>
  );
}

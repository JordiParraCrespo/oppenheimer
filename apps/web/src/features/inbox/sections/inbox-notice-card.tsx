import {
  Button,
  InboxMessage,
  InboxMessageActions,
  InboxMessageBody,
} from '@oppenheimer/design-system-web';
import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { InboxKindIcon } from '@/features/inbox/components/inbox-kind-icon';
import type { InboxCopy } from '@/features/inbox/lib/inbox-copy';

/**
 * A line a session's agent sent you (`runner sessions notify`): its words as
 * the body and the session to open; the dock's Done is the answer — a notice
 * asks nothing of the agent, only that you saw it.
 */
export function InboxNoticeCard({
  item,
  copy,
  from,
  age,
}: {
  item: Extract<InboxItem, { kind: 'notice' }>;
  copy: InboxCopy;
  from: string;
  age: string;
}) {
  const { t } = useTranslation();
  return (
    <InboxMessage
      icon={<InboxKindIcon kind="notice" />}
      sender={copy.sender}
      meta={from}
      title={copy.title}
      age={age}
    >
      <InboxMessageBody>{copy.body}</InboxMessageBody>
      <InboxMessageActions>
        <Button
          variant="secondary"
          render={<Link to="/sessions/$sessionId" params={{ sessionId: item.session.id }} />}
        >
          {t('inbox.session.open')}
        </Button>
      </InboxMessageActions>
    </InboxMessage>
  );
}

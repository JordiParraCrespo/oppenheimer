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
 * A session whose turn ended thirty minutes ago and that nobody has opened
 * since: the session to open, which reads its turn and takes the item away.
 * The dock's Done puts it away without opening it.
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

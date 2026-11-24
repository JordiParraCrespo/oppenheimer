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
 * A line a bot sent you (its `notify` tool): its words as the body, its chat
 * to open; the dock's Done is the answer — a notice asks nothing of the bot,
 * only that you saw it.
 */
export function InboxBotNoticeCard({
  item,
  copy,
  from,
  age,
}: {
  item: Extract<InboxItem, { kind: 'botNotice' }>;
  copy: InboxCopy;
  from: string;
  age: string;
}) {
  const { t } = useTranslation();
  return (
    <InboxMessage
      icon={<InboxKindIcon kind="botNotice" />}
      sender={copy.sender}
      meta={from}
      title={copy.title}
      age={age}
    >
      <InboxMessageBody>{copy.body}</InboxMessageBody>
      <InboxMessageActions>
        <Button
          variant="secondary"
          render={<Link to="/bots/$botId" params={{ botId: item.notice.botId }} />}
        >
          {t('inbox.botNotice.openChat')}
        </Button>
      </InboxMessageActions>
    </InboxMessage>
  );
}

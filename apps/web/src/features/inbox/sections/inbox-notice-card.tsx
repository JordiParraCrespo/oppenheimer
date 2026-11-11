import {
  Button,
  InboxMessage,
  InboxMessageActions,
  InboxMessageBody,
} from '@oppenheimer/design-system-web';
import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { InboxKindIcon } from '@/features/inbox/components/inbox-kind-icon';
import { useInboxMarks } from '@/features/inbox/hooks/use-inbox-marks';
import type { InboxCopy } from '@/features/inbox/lib/inbox-copy';
import { InboxLaterButton } from '@/features/inbox/sections/inbox-later-button';

/**
 * A line a session's agent sent you (`runner sessions notify`): its words as
 * the body, the session to open, and Done, which is the answer — a notice
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
  const marks = useInboxMarks();
  return (
    <InboxMessage
      icon={<InboxKindIcon kind="notice" />}
      sender={copy.sender}
      meta={from}
      title={copy.title}
      age={age}
    >
      <InboxMessageBody>{copy.body}</InboxMessageBody>
      {marks.error ? (
        <ErrorAlert
          error={marks.error}
          fallback={t('inbox.card.answerFailed')}
          onDismiss={marks.dismiss}
        />
      ) : null}
      <InboxMessageActions
        leading={
          <>
            <InboxLaterButton itemKey={item.key} />
            <Button
              variant="secondary"
              render={<Link to="/sessions/$sessionId" params={{ sessionId: item.session.id }} />}
            >
              {t('inbox.session.open')}
            </Button>
          </>
        }
      >
        <Button onClick={() => marks.apply('done', item)}>{t('inbox.notice.done')}</Button>
      </InboxMessageActions>
    </InboxMessage>
  );
}

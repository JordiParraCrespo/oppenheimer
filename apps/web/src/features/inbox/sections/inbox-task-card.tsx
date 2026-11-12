import {
  Button,
  InboxMessage,
  InboxMessageActions,
  InboxMessageBody,
  InboxMessageFacts,
} from '@oppenheimer/design-system-web';
import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { useTriageTask, useUpdateTask } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatCalendarDay, todayIn, useLocale } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { InboxKindIcon } from '@/features/inbox/components/inbox-kind-icon';
import type { InboxCopy } from '@/features/inbox/lib/inbox-copy';
import { inboxVisit } from '@/features/inbox/lib/inbox-visit';
import { InboxLaterButton } from '@/features/inbox/sections/inbox-later-button';

/**
 * A task an agent made (`29-inbox.md`, "Tasks an agent made"), in the pane:
 * its notes and when it is due, then what the person does with it. **Put on
 * today** gives it today as its TODO day, **Start session** opens Start
 * session for it on the board, and **Dismiss** keeps it on the board as it
 * is; each takes it up, and it leaves the Inbox. Open task opens it on the
 * board to read or edit first.
 */
export function InboxTaskCard({
  item,
  copy,
  from,
  age,
}: {
  item: Extract<InboxItem, { kind: 'task' }>;
  copy: InboxCopy;
  from: string;
  age: string;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const plan = useUpdateTask();
  const dismiss = useTriageTask();
  const { task } = item;
  const answered = { onSuccess: () => inboxVisit.answered(item.key) };
  const error = plan.error ?? dismiss.error;

  return (
    <InboxMessage
      icon={<InboxKindIcon kind="task" />}
      sender={copy.sender}
      meta={from}
      title={copy.title}
      age={age}
    >
      <InboxMessageBody className="whitespace-pre-wrap break-words">{copy.body}</InboxMessageBody>
      <InboxMessageFacts>
        <span>{t(`tasks.columns.${task.status}`)}</span>
        {task.dueDate ? (
          <span>{t('inbox.task.due', { date: formatCalendarDay(task.dueDate, locale) })}</span>
        ) : null}
      </InboxMessageFacts>
      {error ? (
        <ErrorAlert
          error={error}
          fallback={t('inbox.card.answerFailed')}
          onDismiss={() => {
            plan.reset();
            dismiss.reset();
          }}
        />
      ) : null}
      <InboxMessageActions
        leading={
          <>
            <InboxLaterButton itemKey={item.key} />
            <Button variant="ghost" render={<Link to="/plan" search={{ task: task.id }} />}>
              {t('inbox.task.open')}
            </Button>
            <Button variant="secondary" render={<Link to="/plan" search={{ start: task.id }} />}>
              {t('inbox.task.start')}
            </Button>
            <Button
              variant="secondary"
              pending={dismiss.isPending}
              pendingLabel={t('inbox.task.dismissing')}
              disabled={plan.isPending}
              onClick={() => dismiss.mutate(task.id, answered)}
            >
              {t('inbox.task.dismiss')}
            </Button>
          </>
        }
      >
        <Button
          pending={plan.isPending}
          pendingLabel={t('inbox.task.planning')}
          disabled={dismiss.isPending}
          onClick={() =>
            plan.mutate({ id: task.id, input: { focusDate: todayIn(Date.now()) } }, answered)
          }
        >
          {t('inbox.task.today')}
        </Button>
      </InboxMessageActions>
    </InboxMessage>
  );
}

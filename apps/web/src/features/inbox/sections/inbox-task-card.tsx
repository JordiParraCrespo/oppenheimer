import {
  Button,
  InboxMessage,
  InboxMessageActions,
  InboxMessageBody,
  InboxMessageFacts,
  TaskPriorityIcon,
} from '@oppenheimer/design-system-web';
import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { useUpdateTask } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatCalendarDay, todayIn, useLocale } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { InboxKindIcon } from '@/features/inbox/components/inbox-kind-icon';
import type { InboxCopy } from '@/features/inbox/lib/inbox-copy';
import { inboxVisit } from '@/features/inbox/lib/inbox-visit';

/**
 * A task an agent made, in the pane: its notes, its priority and when it is due, then
 * what the person does with it. **Put on today** gives it today as its TODO
 * day and **Start session** opens Start session for it on the board; either
 * takes it up, and it leaves the Inbox. The dock's Done keeps it on the board
 * as it is and takes it up too (the mark actions' `takesUp`).
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
  const { task } = item;
  const answered = { onSuccess: () => inboxVisit.answered(item.key) };

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
        {task.priority ? (
          <span className="inline-flex items-center gap-1">
            <TaskPriorityIcon priority={task.priority} />
            {t('tasks.card.priority', { level: t(`tasks.priority.${task.priority}`) })}
          </span>
        ) : null}
        {task.dueDate ? (
          <span>{t('inbox.task.due', { date: formatCalendarDay(task.dueDate, locale) })}</span>
        ) : null}
      </InboxMessageFacts>
      {plan.error ? (
        <ErrorAlert
          error={plan.error}
          fallback={t('inbox.card.answerFailed')}
          onDismiss={plan.reset}
        />
      ) : null}
      <InboxMessageActions>
        <Button
          pending={plan.isPending}
          pendingLabel={t('inbox.task.planning')}
          onClick={() =>
            plan.mutate({ id: task.id, input: { focusDate: todayIn(Date.now()) } }, answered)
          }
        >
          {t('inbox.task.today')}
        </Button>
        <Button variant="secondary" render={<Link to="/plan" search={{ start: task.id }} />}>
          {t('inbox.task.start')}
        </Button>
      </InboxMessageActions>
    </InboxMessage>
  );
}

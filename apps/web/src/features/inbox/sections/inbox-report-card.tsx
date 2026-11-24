import { Button, InboxMessage, InboxMessageBody } from '@oppenheimer/design-system-web';
import { SquareArrowOutUpRight } from '@oppenheimer/design-system-web/icons';
import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { useAnswerInboxReport } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { InboxKindIcon } from '@/features/inbox/components/inbox-kind-icon';
import { ReportAnswerForm } from '@/features/inbox/forms/report-answer-form';
import type { InboxCopy } from '@/features/inbox/lib/inbox-copy';
import { inboxVisit } from '@/features/inbox/lib/inbox-visit';
import { InboxReportImages } from '@/features/inbox/sections/inbox-report-images';

/**
 * A problem an unattended agent sent, in the pane: its words as written,
 * where it can be seen, its pictures, and the answer, which is given here
 * and nowhere else. Answering takes it out of the Inbox; Done puts it away
 * unanswered. An answer refused because the report was answered somewhere
 * else first reads the reports again, and the refusal stays on the card
 * until the list has it gone.
 */
export function InboxReportCard({
  item,
  copy,
  from,
  age,
}: {
  item: Extract<InboxItem, { kind: 'report' }>;
  copy: InboxCopy;
  from: string;
  age: string;
}) {
  const { t } = useTranslation();
  const answer = useAnswerInboxReport();
  const { report } = item;

  return (
    <InboxMessage
      icon={<InboxKindIcon kind="report" />}
      sender={copy.sender}
      meta={from}
      title={copy.title}
      age={age}
    >
      {copy.body ? (
        <InboxMessageBody className="whitespace-pre-wrap break-words">{copy.body}</InboxMessageBody>
      ) : null}
      {report.images.length > 0 ? <InboxReportImages report={report} /> : null}
      <ReportAnswerForm
        pending={answer.isPending}
        onSubmit={({ text }) =>
          answer.mutate(
            { id: report.id, text },
            {
              onSuccess: () => {
                inboxVisit.answered(item.key);
              },
            },
          )
        }
        alert={
          answer.error ? (
            <ErrorAlert
              error={answer.error}
              fallback={t('inbox.report.answerFailed')}
              onDismiss={answer.reset}
            />
          ) : null
        }
        link={
          report.href ? (
            <Button
              variant="secondary"
              render={<a href={report.href} target="_blank" rel="noreferrer" />}
            >
              <SquareArrowOutUpRight />
              {t('inbox.report.openLink')}
            </Button>
          ) : null
        }
      />
    </InboxMessage>
  );
}

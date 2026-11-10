import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  InboxMessageActions,
  Textarea,
} from '@oppenheimer/design-system-web';
import { useZodResolver } from '@oppenheimer/frontend-web';
import {
  type AnswerInboxReportDto,
  answerInboxReportSchema,
  INBOX_REPORT_ANSWER_MAX,
} from '@oppenheimer/shared/schemas/inbox';
import type * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/**
 * The answer to a report, written on its card: one text, which the agent
 * that sent the report reads back. `alert` sits over the answer row,
 * `leading` is that row's left side (Later, the link, Done).
 */
export function ReportAnswerForm({
  pending,
  onSubmit,
  alert,
  leading,
}: {
  pending: boolean;
  onSubmit: (values: AnswerInboxReportDto) => void;
  alert: React.ReactNode;
  leading: React.ReactNode;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AnswerInboxReportDto>({
    resolver: useZodResolver(answerInboxReportSchema),
    defaultValues: { text: '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <Field data-invalid={Boolean(errors.text)}>
        <FieldLabel htmlFor="inbox-report-answer">{t('inbox.report.answerLabel')}</FieldLabel>
        <Textarea
          {...register('text')}
          id="inbox-report-answer"
          rows={3}
          maxLength={INBOX_REPORT_ANSWER_MAX}
          placeholder={t('inbox.report.answerPlaceholder')}
          aria-invalid={Boolean(errors.text)}
          disabled={pending}
        />
        <FieldError errors={[errors.text]} />
      </Field>
      {alert}
      <InboxMessageActions leading={leading}>
        <Button type="submit" pending={pending} pendingLabel={t('inbox.report.sending')}>
          {t('inbox.report.send')}
        </Button>
      </InboxMessageActions>
    </form>
  );
}

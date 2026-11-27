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
  type SendSessionPromptDto,
  sendSessionPromptSchema,
} from '@oppenheimer/shared/schemas/session';
import type * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/**
 * A message to a session's agent, written on its Inbox card: one text, typed
 * into the agent's prompt as its chat would. Enter sends; Shift+Enter breaks
 * the line, and Enter while an IME is composing is the IME's. The text stays
 * until the send succeeds, so a refused send loses nothing; `alert` sits over
 * the actions and `link` stands beside Send.
 */
export function SessionReplyForm({
  id,
  pending,
  onSubmit,
  alert,
  link,
}: {
  id: string;
  pending: boolean;
  onSubmit: (values: SendSessionPromptDto) => void;
  alert: React.ReactNode;
  link: React.ReactNode;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SendSessionPromptDto>({
    resolver: useZodResolver(sendSessionPromptSchema),
    defaultValues: { text: '' },
  });
  const submit = handleSubmit(onSubmit);

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field data-invalid={Boolean(errors.text)}>
        <FieldLabel htmlFor={id}>{t('inbox.unattended.replyLabel')}</FieldLabel>
        <Textarea
          {...register('text')}
          id={id}
          rows={3}
          placeholder={t('inbox.unattended.replyPlaceholder')}
          aria-invalid={Boolean(errors.text)}
          disabled={pending}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            void submit();
          }}
        />
        <FieldError errors={[errors.text]} />
      </Field>
      {alert}
      <InboxMessageActions>
        <Button type="submit" pending={pending} pendingLabel={t('inbox.unattended.sending')}>
          {t('inbox.unattended.send')}
        </Button>
        {link}
      </InboxMessageActions>
    </form>
  );
}

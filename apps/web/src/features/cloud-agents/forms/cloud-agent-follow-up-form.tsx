import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Textarea,
} from '@oppenheimer/design-system-web';
import { useZodResolver } from '@oppenheimer/frontend-web';
import {
  type FollowUpCloudAgentDto,
  followUpCloudAgentSchema,
} from '@oppenheimer/shared/schemas/cloud-agent';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/**
 * The agent's next instruction. `disabledReason` is why it cannot be sent
 * now (a run is still going). The section remounts the form once a send
 * worked, so a failed one keeps what was written.
 */
export function CloudAgentFollowUpForm({
  disabledReason,
  pending,
  onSubmit,
}: {
  disabledReason?: string;
  pending: boolean;
  onSubmit: (prompt: string) => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FollowUpCloudAgentDto>({
    resolver: useZodResolver(followUpCloudAgentSchema),
    defaultValues: { prompt: '' },
  });
  const disabled = pending || disabledReason !== undefined;

  return (
    <form
      onSubmit={handleSubmit(({ prompt }) => onSubmit(prompt))}
      noValidate
      className="flex flex-col gap-3"
    >
      <Field data-invalid={Boolean(errors.prompt)}>
        <FieldLabel htmlFor="cloudAgentFollowUp">
          {t('sessions.cloudAgents.detail.followUp')}
        </FieldLabel>
        <Textarea
          {...register('prompt')}
          id="cloudAgentFollowUp"
          rows={3}
          placeholder={t('sessions.cloudAgents.detail.followUpPlaceholder')}
          aria-invalid={Boolean(errors.prompt)}
          disabled={disabled}
        />
        {disabledReason ? <FieldDescription>{disabledReason}</FieldDescription> : null}
        <FieldError errors={[errors.prompt]} />
      </Field>
      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          disabled={disabledReason !== undefined}
          pending={pending}
          pendingLabel={t('sessions.cloudAgents.detail.sending')}
        >
          {t('sessions.cloudAgents.detail.send')}
        </Button>
      </div>
    </form>
  );
}

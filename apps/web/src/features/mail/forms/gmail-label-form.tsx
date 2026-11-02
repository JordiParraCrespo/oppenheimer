import { Button, Field, FieldError, FieldLabel, Input } from '@oppenheimer/design-system-web';
import { useZodResolver } from '@oppenheimer/frontend-web';
import {
  type UpdateGmailConnectionDto,
  updateGmailConnectionSchema,
} from '@oppenheimer/shared/schemas/mail';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/** One field: the account's name, over the shared schema's bounds. A blank name falls back to the address. */
export function GmailLabelForm({
  label,
  isPending,
  onSubmit,
  onCancel,
}: {
  label: string;
  isPending: boolean;
  onSubmit: (values: UpdateGmailConnectionDto) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateGmailConnectionDto>({
    resolver: useZodResolver(updateGmailConnectionSchema),
    values: { label },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <Field data-invalid={Boolean(errors.label)}>
        <FieldLabel htmlFor="gmailLabel">{t('settings.mail.labelField')}</FieldLabel>
        <Input
          {...register('label')}
          id="gmailLabel"
          autoComplete="off"
          aria-invalid={Boolean(errors.label)}
          disabled={isPending}
        />
        <FieldError errors={[errors.label]} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" pending={isPending} pendingLabel={t('settings.mail.saving')}>
          {t('settings.mail.save')}
        </Button>
      </div>
    </form>
  );
}

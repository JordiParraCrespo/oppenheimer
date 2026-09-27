import { Button, Field, FieldError, FieldLabel, Input } from '@oppenheimer/design-system-web';
import { useZodResolver } from '@oppenheimer/frontend-web';
import { type DeleteAccountDto, deleteAccountSchema } from '@oppenheimer/shared/schemas/profile';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/**
 * The confirmation: the account's email, typed out. The same comparison the
 * API makes — case and surrounding spaces aside — is made here first, so a
 * typo reads under the field instead of as a failed request.
 */
function confirmationSchema(email: string, mismatch: string) {
  return deleteAccountSchema.refine(
    (values) => values.confirmation.trim().toLowerCase() === email.toLowerCase(),
    { path: ['confirmation'], message: mismatch },
  );
}

export function DeleteAccountForm({
  email,
  isPending,
  onSubmit,
  onCancel,
}: {
  email: string;
  isPending: boolean;
  onSubmit: (dto: DeleteAccountDto) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DeleteAccountDto>({
    resolver: useZodResolver(confirmationSchema(email, t('settings.deleteAccount.mismatch'))),
    defaultValues: { confirmation: '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <Field data-invalid={Boolean(errors.confirmation)}>
        <FieldLabel htmlFor="delete-confirmation">
          {t('settings.deleteAccount.confirmLabel', { email })}
        </FieldLabel>
        <Input
          {...register('confirmation')}
          id="delete-confirmation"
          type="email"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={Boolean(errors.confirmation)}
          disabled={isPending}
        />
        <FieldError errors={[errors.confirmation]} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="destructive" disabled={isPending}>
          {isPending ? t('settings.deleteAccount.deleting') : t('settings.deleteAccount.confirm')}
        </Button>
      </div>
    </form>
  );
}

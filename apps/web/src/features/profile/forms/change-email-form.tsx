import { Button, Field, FieldError, FieldLabel, Input } from '@oppenheimer/design-system-web';
import { useZodResolver } from '@oppenheimer/frontend-web';
import { type ChangeEmailDto, changeEmailSchema } from '@oppenheimer/shared/schemas/profile';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/** The new address, and the button that sends the link to it. */
export function ChangeEmailForm({
  isPending,
  onSubmit,
  onCancel,
}: {
  isPending: boolean;
  onSubmit: (dto: ChangeEmailDto) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangeEmailDto>({
    resolver: useZodResolver(changeEmailSchema),
    defaultValues: { newEmail: '' },
  });

  return (
    <form
      onSubmit={(event) => {
        // This dialog opens from a row of the profile card, which is itself a
        // form. The dialog is portalled out of it in the DOM but not in React,
        // and React delivers a submit through the portal to the card too.
        event.stopPropagation();
        return handleSubmit(onSubmit)(event);
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      <Field data-invalid={Boolean(errors.newEmail)}>
        <FieldLabel htmlFor="new-email">{t('settings.changeEmail.newEmail')}</FieldLabel>
        <Input
          {...register('newEmail')}
          id="new-email"
          type="email"
          autoComplete="email"
          autoFocus
          aria-invalid={Boolean(errors.newEmail)}
          disabled={isPending}
        />
        <FieldError errors={[errors.newEmail]} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" pending={isPending} pendingLabel={t('settings.changeEmail.sending')}>
          {t('settings.changeEmail.send')}
        </Button>
      </div>
    </form>
  );
}

import { Button, FieldError, Input } from '@oppenheimer/design-system-web';
import { CardFoot, FieldRow, SectionCard, useZodResolver } from '@oppenheimer/frontend-web';
import { changeOwnPasswordSchema } from '@oppenheimer/shared/schemas/profile';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

const passwordFormBase = changeOwnPasswordSchema
  .pick({ currentPassword: true, newPassword: true })
  .extend({ confirmPassword: z.string().min(8) });

export type PasswordFormValues = z.infer<typeof passwordFormBase>;

const EMPTY_FORM: PasswordFormValues = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export function PasswordForm({
  isPending,
  onSubmit,
}: {
  isPending: boolean;
  /** Resolves once the password is changed; rejects when the request fails. */
  onSubmit: (values: PasswordFormValues) => Promise<void>;
}) {
  const { t } = useTranslation();

  // "The two must match" is the one rule whose meaning cannot be recovered from
  // a Zod issue code, so it carries its own message — built inside the
  // component because that is where a translated `t` exists.
  const schema = passwordFormBase.refine(
    (values) => values.newPassword === values.confirmPassword,
    {
      message: t('profile.password.mismatch'),
      path: ['confirmPassword'],
    },
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    resolver: useZodResolver(schema),
    defaultValues: EMPTY_FORM,
  });

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch {
      // The section shows the failure; the fields stay for another attempt.
      return;
    }
    // The fields are cleared, not left filled: the card is done, and a
    // password sitting in a form is a password sitting in the DOM.
    reset(EMPTY_FORM);
  });

  return (
    <form onSubmit={submit} noValidate>
      <SectionCard className="mb-6">
        <FieldRow label={t('profile.password.current')}>
          <Input
            {...register('currentPassword')}
            id="current-password"
            type="password"
            aria-label={t('profile.password.current')}
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={Boolean(errors.currentPassword)}
            disabled={isPending}
          />
          <FieldError errors={[errors.currentPassword]} />
        </FieldRow>

        <FieldRow label={t('profile.password.new')} hint={t('profile.password.newDescription')}>
          <Input
            {...register('newPassword')}
            id="new-password"
            type="password"
            aria-label={t('profile.password.new')}
            autoComplete="new-password"
            placeholder={t('profile.password.newPlaceholder')}
            aria-invalid={Boolean(errors.newPassword)}
            disabled={isPending}
          />
          <FieldError errors={[errors.newPassword]} />
        </FieldRow>

        <FieldRow label={t('profile.password.confirm')}>
          <Input
            {...register('confirmPassword')}
            id="confirm-password"
            type="password"
            aria-label={t('profile.password.confirm')}
            autoComplete="new-password"
            placeholder={t('profile.password.confirmPlaceholder')}
            aria-invalid={Boolean(errors.confirmPassword)}
            disabled={isPending}
          />
          <FieldError errors={[errors.confirmPassword]} />
        </FieldRow>

        <CardFoot>
          <Button type="submit" size="lg" disabled={isPending}>
            {t('profile.password.submit')}
          </Button>
        </CardFoot>
      </SectionCard>
    </form>
  );
}

import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  PasswordInput,
} from '@oppenheimer/design-system-web';
import { useZodResolver } from '@oppenheimer/frontend-web';
import { changeOwnPasswordSchema } from '@oppenheimer/shared/schemas/profile';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

/**
 * The shared schema holds the password policy; whether the two new ones
 * match is this form's, and a `refine` states its own message, so it is
 * handed in already translated.
 */
function passwordFormSchema(mismatch: string) {
  return changeOwnPasswordSchema
    .pick({ currentPassword: true, newPassword: true })
    .extend({ confirmPassword: z.string() })
    .refine((values) => values.newPassword === values.confirmPassword, {
      path: ['confirmPassword'],
      message: mismatch,
    });
}

export type ChangePasswordValues = z.infer<ReturnType<typeof passwordFormSchema>>;

type PasswordField = keyof ChangePasswordValues;

export function ChangePasswordForm({
  isPending,
  onSubmit,
  onCancel,
}: {
  isPending: boolean;
  onSubmit: (values: ChangePasswordValues) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordValues>({
    resolver: useZodResolver(passwordFormSchema(t('settings.changePassword.mismatch'))),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const fields: { name: PasswordField; label: string; autoComplete: string }[] = [
    {
      name: 'currentPassword',
      label: t('settings.changePassword.current'),
      autoComplete: 'current-password',
    },
    { name: 'newPassword', label: t('settings.changePassword.new'), autoComplete: 'new-password' },
    {
      name: 'confirmPassword',
      label: t('settings.changePassword.confirm'),
      autoComplete: 'new-password',
    },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {fields.map((field) => (
        <Field key={field.name} data-invalid={Boolean(errors[field.name])}>
          <FieldLabel htmlFor={field.name}>{field.label}</FieldLabel>
          <PasswordInput
            {...register(field.name)}
            id={field.name}
            autoComplete={field.autoComplete}
            aria-invalid={Boolean(errors[field.name])}
            disabled={isPending}
            showLabel={t('auth.showPassword')}
            hideLabel={t('auth.hidePassword')}
          />
          <FieldError errors={[errors[field.name]]} />
        </Field>
      ))}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending
            ? t('settings.changePassword.submitting')
            : t('settings.changePassword.submit')}
        </Button>
      </div>
    </form>
  );
}

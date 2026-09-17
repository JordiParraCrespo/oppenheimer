import { Button, FieldGroup, Input, PasswordInput } from '@oppenheimer/design-system-web';
import { AuthField, AuthFormError, useZodResolver } from '@oppenheimer/frontend-web';
import { type RegisterDto, registerSchema } from '@oppenheimer/shared/schemas/auth';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/**
 * The artboard asks for an email and a password. The account also carries a
 * name — the API builds the personal workspace's name from it — so the two
 * name fields stay, in one row above the address.
 */
export function RegisterForm({
  isPending,
  error,
  onSubmit,
}: {
  isPending: boolean;
  /** The resolved failure message, if the last attempt failed. */
  error?: string;
  onSubmit: (values: RegisterDto) => void;
}) {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterDto>({
    resolver: useZodResolver(registerSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {error && <AuthFormError>{error}</AuthFormError>}

        <div className="grid grid-cols-2 gap-3">
          <AuthField label={t('auth.firstName')} htmlFor="firstName" error={errors.firstName}>
            <Input
              {...register('firstName')}
              id="firstName"
              size="lg"
              autoComplete="given-name"
              placeholder={t('auth.firstNamePlaceholder')}
              aria-invalid={Boolean(errors.firstName)}
              disabled={isPending}
            />
          </AuthField>
          <AuthField label={t('auth.lastName')} htmlFor="lastName" error={errors.lastName}>
            <Input
              {...register('lastName')}
              id="lastName"
              size="lg"
              autoComplete="family-name"
              placeholder={t('auth.lastNamePlaceholder')}
              aria-invalid={Boolean(errors.lastName)}
              disabled={isPending}
            />
          </AuthField>
        </div>

        <AuthField label={t('auth.email')} htmlFor="email" error={errors.email}>
          <Input
            {...register('email')}
            id="email"
            type="email"
            size="lg"
            autoComplete="email"
            placeholder={t('auth.emailPlaceholder')}
            aria-invalid={Boolean(errors.email)}
            disabled={isPending}
          />
        </AuthField>

        <AuthField
          label={t('auth.password')}
          htmlFor="password"
          error={errors.password}
          hint={t('auth.register.passwordHint')}
        >
          <PasswordInput
            {...register('password')}
            id="password"
            size="lg"
            autoComplete="new-password"
            placeholder={t('auth.register.passwordPlaceholder')}
            aria-invalid={Boolean(errors.password)}
            disabled={isPending}
            showLabel={t('auth.showPassword')}
            hideLabel={t('auth.hidePassword')}
          />
        </AuthField>

        <Button type="submit" size="lg" block disabled={isPending}>
          {isPending ? t('auth.register.submitting') : t('auth.register.submit')}
        </Button>
      </FieldGroup>
    </form>
  );
}

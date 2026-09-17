import { Button, FieldGroup, Input } from '@oppenheimer/design-system-web';
import {
  AuthField,
  AuthFormError,
  authControlClass,
  authInputClass,
  PasswordInput,
  type PasswordRule,
  useZodResolver,
} from '@oppenheimer/frontend-web';
import { type RegisterDto, registerSchema } from '@oppenheimer/shared/schemas/auth';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { PasswordChecklist } from '@/features/auth/components/password-checklist';

const RULES: readonly PasswordRule[] = ['length', 'case', 'number'];

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
    control,
    formState: { errors },
  } = useForm<RegisterDto>({
    resolver: useZodResolver(registerSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-4">
        {error && <AuthFormError>{error}</AuthFormError>}

        <div className="grid grid-cols-2 gap-3">
          <AuthField label={t('auth.firstName')} htmlFor="firstName" error={errors.firstName}>
            <Input
              {...register('firstName')}
              id="firstName"
              autoComplete="given-name"
              placeholder={t('auth.firstNamePlaceholder')}
              aria-invalid={Boolean(errors.firstName)}
              disabled={isPending}
              className={authInputClass}
            />
          </AuthField>
          <AuthField label={t('auth.lastName')} htmlFor="lastName" error={errors.lastName}>
            <Input
              {...register('lastName')}
              id="lastName"
              autoComplete="family-name"
              placeholder={t('auth.lastNamePlaceholder')}
              aria-invalid={Boolean(errors.lastName)}
              disabled={isPending}
              className={authInputClass}
            />
          </AuthField>
        </div>

        <AuthField label={t('auth.email')} htmlFor="email" error={errors.email}>
          <Input
            {...register('email')}
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t('auth.emailPlaceholder')}
            aria-invalid={Boolean(errors.email)}
            disabled={isPending}
            className={authInputClass}
          />
        </AuthField>

        <AuthField
          label={t('auth.register.passwordLabel')}
          htmlFor="password"
          error={errors.password}
        >
          <PasswordInput
            {...register('password')}
            id="password"
            autoComplete="new-password"
            placeholder={t('auth.register.passwordPlaceholder')}
            aria-invalid={Boolean(errors.password)}
            disabled={isPending}
          />
        </AuthField>

        <PasswordChecklist
          control={control}
          name="password"
          rules={RULES}
          className="-mt-1.5 mb-1.5"
        >
          {(satisfied) => (
            <Button type="submit" disabled={isPending || !satisfied} className={authControlClass}>
              {isPending ? t('auth.register.submitting') : t('auth.register.submit')}
            </Button>
          )}
        </PasswordChecklist>
      </FieldGroup>
    </form>
  );
}

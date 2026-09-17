import { Button, Checkbox, FieldGroup, Input } from '@oppenheimer/design-system-web';
import {
  AuthField,
  AuthFormError,
  authControlClass,
  authInputClass,
  useZodResolver,
} from '@oppenheimer/frontend-web';
import { type LoginDto, loginSchema } from '@oppenheimer/shared/schemas/auth';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

export function LoginForm({
  defaultEmail,
  isPending,
  error,
  forgotPasswordLink,
  onSubmit,
}: {
  defaultEmail?: string;
  isPending: boolean;
  /** The resolved failure message, if the last attempt failed. */
  error?: string;
  /** The "Forgot password?" link, rendered beside the keep-signed-in control. */
  forgotPasswordLink: ReactNode;
  onSubmit: (values: LoginDto) => void;
}) {
  const { t } = useTranslation();

  // Session lifetime is decided by the API, so this is presentational for now:
  // the control exists in the design and the preference has nowhere to go
  // until the login endpoint accepts one.
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginDto>({
    resolver: useZodResolver(loginSchema),
    defaultValues: { email: defaultEmail ?? '', password: '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-4">
        {error && <AuthFormError>{error}</AuthFormError>}

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

        <AuthField label={t('auth.password')} htmlFor="password" error={errors.password}>
          <Input
            {...register('password')}
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder={t('auth.passwordPlaceholder')}
            aria-invalid={Boolean(errors.password)}
            disabled={isPending}
            className={authInputClass}
          />
        </AuthField>

        {/* 21px is the design's row: a 15px box plus the 3px the UA puts around a
            native checkbox. Pinned so the column keeps its rhythm. */}
        <div className="mb-2 flex h-[21px] items-center justify-between">
          <label
            htmlFor="keepSignedIn"
            className="flex cursor-pointer items-center gap-2 text-sm text-ink-600"
          >
            <Checkbox
              id="keepSignedIn"
              checked={keepSignedIn}
              onCheckedChange={setKeepSignedIn}
              disabled={isPending}
              className="size-[15px] rounded-[4.5px] [&_svg]:size-2.5"
            />
            {t('auth.login.keepSignedIn')}
          </label>
          {forgotPasswordLink}
        </div>

        <Button type="submit" disabled={isPending} className={authControlClass}>
          {isPending ? t('auth.login.submitting') : t('auth.login.submit')}
        </Button>
      </FieldGroup>
    </form>
  );
}

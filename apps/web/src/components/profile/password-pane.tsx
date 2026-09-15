import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  FieldError,
  Input,
  Switch,
  toast,
} from '@oppenheimer/design-system-web';
import { ShieldCheck } from '@oppenheimer/design-system-web/icons';
import type { ProfileEntity } from '@oppenheimer/frontend';
import { useChangeOwnPassword } from '@oppenheimer/frontend/react';
import { changeOwnPasswordSchema } from '@oppenheimer/shared/schemas/profile';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  CardFoot,
  FieldRow,
  RowControl,
  RowMedia,
  RowMeta,
  SectionCard,
  SectionHead,
  SectionRow,
} from '@/components/section-ui';
import { useErrorMessage } from '@/lib/use-error-message';
import { useZodResolver } from '@/lib/use-zod-resolver';

const passwordFormBase = changeOwnPasswordSchema
  .pick({ currentPassword: true, newPassword: true })
  .extend({ confirmPassword: z.string().min(8) });

type PasswordFormValues = z.infer<typeof passwordFormBase>;

const EMPTY_FORM: PasswordFormValues = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export function PasswordPane({ profile }: { profile: ProfileEntity }) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const change = useChangeOwnPassword();

  // "The two must match" is the one rule whose meaning cannot be recovered from
  // a Zod issue code, so it carries its own message — built inside the
  // component because that is where a translated `t` exists.
  const schema = useMemo(
    () =>
      passwordFormBase.refine((values) => values.newPassword === values.confirmPassword, {
        message: t('profile.password.mismatch'),
        path: ['confirmPassword'],
      }),
    [t],
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

  const onSubmit = handleSubmit((values) => {
    change.mutate(
      {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        // The usual reason to change a password is that somebody else may know
        // the old one; leaving their session alive would make this pointless.
        revokeOtherSessions: true,
      },
      {
        onSuccess: () => {
          // The fields are cleared, not left filled: the card is done, and a
          // password sitting in a form is a password sitting in the DOM.
          reset(EMPTY_FORM);
          toast.success(t('toasts.passwordChanged'));
        },
      },
    );
  });

  return (
    <>
      <SectionHead title={t('profile.password.title')} sub={t('profile.password.description')} />

      {change.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{resolveError(change.error).message}</AlertDescription>
        </Alert>
      )}
      <form onSubmit={onSubmit} noValidate>
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
              disabled={change.isPending}
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
              disabled={change.isPending}
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
              disabled={change.isPending}
            />
            <FieldError errors={[errors.confirmPassword]} />
          </FieldRow>

          <CardFoot>
            <Button type="submit" size="lg" disabled={change.isPending}>
              {t('profile.password.submit')}
            </Button>
          </CardFoot>
        </SectionCard>
      </form>

      <SectionCard>
        <SectionRow>
          <RowMedia>
            <ShieldCheck className="size-[17px] text-ink-600" />
          </RowMedia>
          <RowMeta
            name={t('profile.password.twoFactor')}
            description={t('profile.password.twoFactorDescription')}
          />
          <RowControl>
            {profile.twoFactorEnabled ? (
              <Badge variant="active">{t('profile.password.twoFactorOn')}</Badge>
            ) : (
              <span className="text-sm text-ink-400">
                {t('profile.password.twoFactorUnavailable')}
              </span>
            )}
            {/* Read-only: this deployment does not run Better Auth's two-factor
                plugin, so there is nothing behind the switch. Shown rather than
                hidden so the row does not appear the day it is enabled and
                surprise anyone. */}
            <Switch
              checked={profile.twoFactorEnabled}
              disabled
              aria-label={t('profile.password.twoFactor')}
            />
          </RowControl>
        </SectionRow>
      </SectionCard>
    </>
  );
}

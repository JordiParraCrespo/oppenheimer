import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  PasswordInput,
} from '@oppenheimer/design-system-web';
import { useZodResolver } from '@oppenheimer/frontend-web';
import {
  type PutSentryConnectionDto,
  putSentryConnectionSchema,
} from '@oppenheimer/shared/schemas/sentry';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/** The organization's slug and the integration's client secret, over the shared schema's bounds. */
export function SentryConnectionForm({
  organizationSlug,
  isPending,
  onSubmit,
  onCancel,
}: {
  /** The slug already connected, kept when only the secret is replaced. */
  organizationSlug: string;
  isPending: boolean;
  onSubmit: (values: PutSentryConnectionDto) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PutSentryConnectionDto>({
    resolver: useZodResolver(putSentryConnectionSchema),
    defaultValues: { organizationSlug, clientSecret: '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <Field data-invalid={Boolean(errors.organizationSlug)}>
        <FieldLabel htmlFor="sentryOrganization">{t('settings.sentry.dialog.slug')}</FieldLabel>
        <Input
          {...register('organizationSlug')}
          id="sentryOrganization"
          autoComplete="off"
          placeholder="acme"
          aria-invalid={Boolean(errors.organizationSlug)}
          disabled={isPending}
        />
        <FieldDescription>{t('settings.sentry.dialog.slugHint')}</FieldDescription>
        <FieldError errors={[errors.organizationSlug]} />
      </Field>
      <Field data-invalid={Boolean(errors.clientSecret)}>
        <FieldLabel htmlFor="sentrySecret">{t('settings.sentry.dialog.secret')}</FieldLabel>
        <PasswordInput
          {...register('clientSecret')}
          id="sentrySecret"
          autoComplete="off"
          aria-invalid={Boolean(errors.clientSecret)}
          disabled={isPending}
          showLabel={t('auth.showPassword')}
          hideLabel={t('auth.hidePassword')}
        />
        <FieldDescription>{t('settings.sentry.dialog.secretHint')}</FieldDescription>
        <FieldError errors={[errors.clientSecret]} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" pending={isPending} pendingLabel={t('settings.sentry.dialog.saving')}>
          {t('settings.sentry.dialog.save')}
        </Button>
      </div>
    </form>
  );
}

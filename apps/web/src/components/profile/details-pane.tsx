import { Alert, AlertDescription, Button, FieldError, Input } from '@oppenheimer/design-system-web';
import type { ProfileEntity } from '@oppenheimer/frontend';
import { useUpdateMyProfile } from '@oppenheimer/frontend/react';
import { updateProfileSchema } from '@oppenheimer/shared/schemas/profile';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { CardFoot, FieldRow, SectionCard, SectionHead } from '@/components/section-ui';
import { useErrorMessage } from '@/lib/use-error-message';
import { useZodResolver } from '@/lib/use-zod-resolver';

/**
 * The card submits every field at once, so the shared PATCH schema's
 * optionality is not what this form validates against — and its `phone` and
 * `jobTitle` reject the empty string a cleared input produces, because in a
 * PATCH "leave it alone" is `undefined` and "clear it" is `null`. The two
 * optional fields are therefore plain bounded strings here — same bounds as
 * `updateProfileSchema`, without its `min(1)` — and the submit handler maps a
 * blank one back to `null`.
 */
const detailsFormSchema = updateProfileSchema.required({ firstName: true, lastName: true }).extend({
  phone: z.string().max(32),
  jobTitle: z.string().max(120),
});

type DetailsFormValues = z.infer<typeof detailsFormSchema>;

function toFormValues(profile: ProfileEntity): DetailsFormValues {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone ?? '',
    jobTitle: profile.jobTitle ?? '',
  };
}

export function DetailsPane({ profile }: { profile: ProfileEntity }) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const update = useUpdateMyProfile();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<DetailsFormValues>({
    resolver: useZodResolver(detailsFormSchema),
    defaultValues: toFormValues(profile),
  });

  // A save answers with the saved document, and so does anything else that
  // refreshes it (another tab, an avatar upload). Re-seeding the form from it
  // keeps "dirty" honest instead of leaving the card looking unsaved.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset is stable, and the form re-seeds only when the saved profile changes.
  useEffect(() => {
    reset(toFormValues(profile));
  }, [profile]);

  const onSubmit = handleSubmit((values) => {
    update.mutate({
      firstName: values.firstName,
      lastName: values.lastName,
      phone: values.phone.trim() || null,
      jobTitle: values.jobTitle.trim() || null,
    });
  });

  return (
    <>
      <SectionHead title={t('profile.details.title')} sub={t('profile.details.description')} />

      {update.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{resolveError(update.error).message}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate>
        <SectionCard>
          <FieldRow label={t('profile.details.firstName')}>
            <Input
              {...register('firstName')}
              id="profile-first-name"
              aria-label={t('profile.details.firstName')}
              autoComplete="given-name"
              aria-invalid={Boolean(errors.firstName)}
              disabled={update.isPending}
            />
            <FieldError errors={[errors.firstName]} />
          </FieldRow>

          <FieldRow label={t('profile.details.lastName')}>
            <Input
              {...register('lastName')}
              id="profile-last-name"
              aria-label={t('profile.details.lastName')}
              autoComplete="family-name"
              aria-invalid={Boolean(errors.lastName)}
              disabled={update.isPending}
            />
            <FieldError errors={[errors.lastName]} />
          </FieldRow>

          <FieldRow label={t('profile.details.email')} hint={t('profile.details.emailDescription')}>
            <Input
              id="profile-email"
              type="email"
              aria-label={t('profile.details.email')}
              value={profile.email}
              readOnly
              className="bg-surface-sunken text-ink-600"
            />
            <p className="mt-1.5 text-xs text-ink-400">{t('profile.details.emailHint')}</p>
          </FieldRow>

          <FieldRow label={t('profile.details.phone')}>
            <Input
              {...register('phone')}
              id="profile-phone"
              type="tel"
              aria-label={t('profile.details.phone')}
              autoComplete="tel"
              aria-invalid={Boolean(errors.phone)}
              disabled={update.isPending}
            />
            <FieldError errors={[errors.phone]} />
          </FieldRow>

          <FieldRow
            label={t('profile.details.jobTitle')}
            hint={t('profile.details.jobTitleDescription')}
          >
            <Input
              {...register('jobTitle')}
              id="profile-job-title"
              aria-label={t('profile.details.jobTitle')}
              autoComplete="organization-title"
              aria-invalid={Boolean(errors.jobTitle)}
              disabled={update.isPending}
            />
            <FieldError errors={[errors.jobTitle]} />
          </FieldRow>

          <CardFoot>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              disabled={!isDirty || update.isPending}
              onClick={() => reset(toFormValues(profile))}
            >
              {t('profile.details.cancel')}
            </Button>
            <Button type="submit" size="lg" disabled={update.isPending}>
              {t('profile.details.save')}
            </Button>
          </CardFoot>
        </SectionCard>
      </form>
    </>
  );
}

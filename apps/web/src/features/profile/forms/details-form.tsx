import { Button, FieldError, Input } from '@oppenheimer/design-system-web';
import type { ProfileEntity } from '@oppenheimer/frontend-consumer';
import { CardFoot, FieldRow, SectionCard, useZodResolver } from '@oppenheimer/frontend-web';
import { updateProfileSchema } from '@oppenheimer/shared/schemas/profile';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

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

export type DetailsFormValues = z.infer<typeof detailsFormSchema>;

export function toDetailsFormValues(profile: ProfileEntity): DetailsFormValues {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone ?? '',
    jobTitle: profile.jobTitle ?? '',
  };
}

export function DetailsForm({
  values,
  email,
  isPending,
  onSubmit,
}: {
  /** Re-seeds the form whenever the saved profile changes. */
  values: DetailsFormValues;
  /** Shown read-only: the address is the account's identity. */
  email: string;
  isPending: boolean;
  onSubmit: (values: DetailsFormValues) => void;
}) {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<DetailsFormValues>({
    resolver: useZodResolver(detailsFormSchema),
    // A save answers with the saved document, and so does anything else that
    // refreshes it (another tab, an avatar upload). `values` re-seeds the form
    // from it whenever it changes, which keeps "dirty" honest instead of
    // leaving the card looking unsaved — and does so without an effect calling
    // `reset` a render late.
    values,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <SectionCard>
        <FieldRow label={t('profile.details.firstName')}>
          <Input
            {...register('firstName')}
            id="profile-first-name"
            aria-label={t('profile.details.firstName')}
            autoComplete="given-name"
            aria-invalid={Boolean(errors.firstName)}
            disabled={isPending}
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
            disabled={isPending}
          />
          <FieldError errors={[errors.lastName]} />
        </FieldRow>

        <FieldRow label={t('profile.details.email')} hint={t('profile.details.emailDescription')}>
          <Input
            id="profile-email"
            type="email"
            aria-label={t('profile.details.email')}
            value={email}
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
            disabled={isPending}
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
            disabled={isPending}
          />
          <FieldError errors={[errors.jobTitle]} />
        </FieldRow>

        <CardFoot>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            disabled={!isDirty || isPending}
            onClick={() => reset(values)}
          >
            {t('profile.details.cancel')}
          </Button>
          <Button type="submit" size="lg" disabled={isPending}>
            {t('profile.details.save')}
          </Button>
        </CardFoot>
      </SectionCard>
    </form>
  );
}

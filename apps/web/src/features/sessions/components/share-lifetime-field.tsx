import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldSelect,
} from '@oppenheimer/design-system-web';
import {
  maxShareLinkLifetime,
  SHARE_LINK_LIFETIME_MS,
  SHARE_LINK_LIFETIMES,
} from '@oppenheimer/shared/schemas/session-share';
import { type Control, Controller, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ShareLinkValues } from '../lib/share-links';

/**
 * How long a link lives. A link that lets anyone with it type offers nothing
 * past its cap (`maxShareLinkLifetime`, seven days) and says why; the cap
 * itself is the API's, and the form's check is the same rule.
 */
export function ShareLifetimeField({
  control,
  error,
  disabled,
}: {
  control: Control<ShareLinkValues>;
  error: { message?: string } | undefined;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const [access, audience] = useWatch({ control, name: ['access', 'audience'] });
  const max = maxShareLinkLifetime(access, audience);
  const offered = [
    ...SHARE_LINK_LIFETIMES.filter(
      (lifetime) => max === null || SHARE_LINK_LIFETIME_MS[lifetime] <= SHARE_LINK_LIFETIME_MS[max],
    ),
    ...(max === null ? (['never'] as const) : []),
  ];

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel>{t('sessions.share.lifetime')}</FieldLabel>
      <Controller
        control={control}
        name="lifetime"
        render={({ field }) => (
          <FieldSelect
            aria-label={t('sessions.share.lifetime')}
            placeholder={t('sessions.share.lifetime')}
            searchPlaceholder={t('sessions.share.lifetimeSearch')}
            emptyText={() => t('sessions.share.lifetimeNone')}
            value={field.value}
            onValueChange={field.onChange}
            disabled={disabled}
            options={offered.map((lifetime) => ({
              value: lifetime,
              label: t(`sessions.share.lifetimes.${lifetime}`),
            }))}
          />
        )}
      />
      {max !== null ? (
        <FieldDescription>{t('sessions.share.lifetimeCapped')}</FieldDescription>
      ) : null}
      <FieldError errors={[error]} />
    </Field>
  );
}

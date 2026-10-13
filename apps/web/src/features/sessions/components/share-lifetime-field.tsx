import { Chip, Field, FieldDescription, FieldLabel, useNow } from '@oppenheimer/design-system-web';
import { formatDateTime, useLocale } from '@oppenheimer/frontend-web';
import { type Control, Controller, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  effectiveAccess,
  lifetimeAllowed,
  lifetimeMs,
  SHARE_LIFETIME_CHOICES,
  type ShareSessionValues,
} from '../lib/share-session';

/** The "Ends …" line moves with the clock, to the minute. */
const CLOCK_MS = 60_000;

/**
 * How long a share lasts, as pills, and when that is. Write access offers
 * nothing past a day; those pills stay on screen, faded, so the row never
 * reflows when the permission changes.
 */
export function ShareLifetimeField({
  control,
  disabled,
}: {
  control: Control<ShareSessionValues>;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(CLOCK_MS);
  const [audience, access, lifetime] = useWatch({
    control,
    name: ['audience', 'access', 'lifetime'],
  });
  const writing = effectiveAccess(audience, access) === 'write';
  const span = lifetimeMs(lifetime);
  const hint =
    span === null
      ? t('sessions.share.neverHint')
      : t(writing ? 'sessions.share.endsWrite' : 'sessions.share.endsRead', {
          date: formatDateTime(new Date(now + span), locale),
        });

  return (
    <Field>
      <FieldLabel>{t('sessions.share.duration')}</FieldLabel>
      <Controller
        control={control}
        name="lifetime"
        render={({ field }) => (
          <fieldset
            className="m-0 flex flex-wrap gap-1.5 border-0 p-0"
            aria-label={t('sessions.share.duration')}
          >
            {SHARE_LIFETIME_CHOICES.map((choice) => (
              <Chip
                key={choice}
                variant="solid"
                selected={field.value === choice}
                disabled={disabled || !lifetimeAllowed(writing ? 'write' : 'read', choice)}
                onClick={() => field.onChange(choice)}
              >
                {t(`sessions.share.lifetimes.${choice}`)}
              </Chip>
            ))}
          </fieldset>
        )}
      />
      <FieldDescription>{hint}</FieldDescription>
    </Field>
  );
}

import {
  Chip,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  useNow,
} from '@oppenheimer/design-system-web';
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
 * reflows when the permission changes. While people are added to a share,
 * no pill is on: its expiry stays as it is until one is picked.
 */
export function ShareLifetimeField({
  control,
  keptUntil,
  error,
  disabled,
}: {
  control: Control<ShareSessionValues>;
  /** The share's own expiry, which `keep` leaves in place; `null` for none. */
  keptUntil: Date | null;
  error: { message?: string } | undefined;
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
  const span = lifetime === 'keep' ? null : lifetimeMs(lifetime);
  const ends = lifetime === 'keep' ? keptUntil : span === null ? null : new Date(now + span);
  const hint =
    lifetime === 'keep'
      ? ends
        ? t('sessions.share.keptUntil', { date: formatDateTime(ends, locale) })
        : t('sessions.share.keptNever')
      : ends === null
        ? t('sessions.share.neverHint')
        : t(writing ? 'sessions.share.endsWrite' : 'sessions.share.endsRead', {
            date: formatDateTime(ends, locale),
          });

  return (
    <Field data-invalid={Boolean(error)}>
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
      <FieldError errors={[error]} />
    </Field>
  );
}

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Textarea,
} from '@oppenheimer/design-system-web';
import { type Control, type UseFormRegisterReturn, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ShareLinkValues } from '../lib/share-links';

/**
 * The emails a link is for, shown only while the audience is specific
 * people. It watches the audience itself, so a pick re-renders this field
 * and not the form around it.
 */
export function SharePeopleField({
  control,
  field,
  error,
  disabled,
}: {
  control: Control<ShareLinkValues>;
  field: UseFormRegisterReturn<'people'>;
  error: { message?: string } | undefined;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const audience = useWatch({ control, name: 'audience' });
  if (audience !== 'people') return null;
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor="share-people">{t('sessions.share.emails')}</FieldLabel>
      <Textarea
        {...field}
        id="share-people"
        rows={3}
        placeholder={t('sessions.share.emailsPlaceholder')}
        aria-invalid={Boolean(error)}
        disabled={disabled}
      />
      <FieldDescription>{t('sessions.share.emailsHint')}</FieldDescription>
      <FieldError errors={[error]} />
    </Field>
  );
}

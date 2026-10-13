import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  SegmentedControl,
  SegmentedControlItem,
} from '@oppenheimer/design-system-web';
import { GlobeIcon, UsersIcon } from '@oppenheimer/design-system-web/icons';
import { SESSION_SHARE_AUDIENCES } from '@oppenheimer/shared/schemas/session-share';
import { type Control, Controller, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ShareSessionValues } from '../lib/share-session';
import { SharePeopleInput } from './share-people-input';

const AUDIENCE_ICONS = { people: UsersIcon, link: GlobeIcon } as const;

/**
 * Who a session is shared with: specific people, or anyone signed in with
 * the link. Under the switch, the people field while it is people, and
 * while it is a link what a link may do. It watches the audience itself, so
 * a switch re-renders this field and not the form around it.
 */
export function ShareAudienceField({
  control,
  error,
  disabled,
}: {
  control: Control<ShareSessionValues>;
  error: { message?: string } | undefined;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const audience = useWatch({ control, name: 'audience' });

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel>{t('sessions.share.who')}</FieldLabel>
      <Controller
        control={control}
        name="audience"
        render={({ field }) => (
          <SegmentedControl
            size="md"
            aria-label={t('sessions.share.who')}
            value={field.value}
            onValueChange={(next) => field.onChange(next)}
            disabled={disabled}
          >
            {SESSION_SHARE_AUDIENCES.map((option) => {
              const Icon = AUDIENCE_ICONS[option];
              return (
                <SegmentedControlItem key={option} value={option}>
                  <Icon className="size-3.25" />
                  {t(`sessions.share.audiences.${option}`)}
                </SegmentedControlItem>
              );
            })}
          </SegmentedControl>
        )}
      />
      {audience === 'people' ? (
        <>
          <Controller
            control={control}
            name="people"
            render={({ field }) => (
              <SharePeopleInput
                value={field.value}
                onChange={field.onChange}
                invalid={Boolean(error)}
                disabled={disabled}
              />
            )}
          />
          <FieldError errors={[error]} />
        </>
      ) : (
        <FieldDescription>{t('sessions.share.linkHint')}</FieldDescription>
      )}
    </Field>
  );
}

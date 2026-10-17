import {
  Field,
  FieldDescription,
  FieldLabel,
  RadioGroup,
  RadioGroupCard,
} from '@oppenheimer/design-system-web';
import { EyeIcon, TerminalIcon } from '@oppenheimer/design-system-web/icons';
import {
  SESSION_SHARE_ACCESS,
  type SessionShareAccess,
} from '@oppenheimer/shared/schemas/session-share';
import { type Control, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { effectiveAccess, type ShareSessionValues } from '../lib/share-session';

const ACCESS_ICONS = { read: EyeIcon, write: TerminalIcon } as const;

/**
 * What the people a session is shared with may do: watch, or write as the
 * person sharing it. Write is the danger card, and needs named people: on a
 * link it is off and the line under the cards says why.
 */
export function ShareAccessField({
  control,
  disabled,
  onPick,
}: {
  control: Control<ShareSessionValues>;
  disabled: boolean;
  /** The form decides what a pick also resets (the acknowledgement, the lifetime). */
  onPick: (access: SessionShareAccess) => void;
}) {
  const { t } = useTranslation();
  const [audience, access] = useWatch({ control, name: ['audience', 'access'] });
  const writeLocked = audience === 'link';

  return (
    <Field>
      <FieldLabel>{t('sessions.share.permission')}</FieldLabel>
      <RadioGroup
        aria-label={t('sessions.share.permission')}
        value={effectiveAccess(audience, access)}
        onValueChange={(next) => onPick(next as SessionShareAccess)}
        disabled={disabled}
        columns={2}
      >
        {SESSION_SHARE_ACCESS.map((option) => {
          const Icon = ACCESS_ICONS[option];
          return (
            <RadioGroupCard
              key={option}
              value={option}
              icon={<Icon />}
              tone={option === 'write' ? 'danger' : 'default'}
              disabled={option === 'write' && writeLocked}
              label={t(`sessions.share.access.${option}.label`)}
              description={t(`sessions.share.access.${option}.hint`)}
            />
          );
        })}
      </RadioGroup>
      {writeLocked ? <FieldDescription>{t('sessions.share.writeLocked')}</FieldDescription> : null}
    </Field>
  );
}

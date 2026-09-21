import { type PermissionLevel, PermissionMenu } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/**
 * What the agent may do on the host without asking.
 *
 * Three levels, and the third is the one that matters: `full` runs everything
 * without asking, on a machine somebody owns, unattended. The design system
 * gives that row and the button a warning tone on its own; what this file adds
 * is the sentence under each label, because a person choosing between these is
 * choosing what a program may do to their laptop and the labels alone do not
 * say it.
 *
 * The copy is translated here rather than in the design system, which is why
 * the levels are passed in: a primitive that carried English would be a
 * primitive nobody could ship in a second language.
 */
export function PermissionSelect({
  value,
  onValueChange,
  disabled,
}: {
  value: PermissionLevel;
  onValueChange: (value: PermissionLevel) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <PermissionMenu
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      aria-label={t('sessions.new.permission.label')}
      options={[
        {
          value: 'ask',
          label: t('sessions.new.permission.ask.label'),
          description: t('sessions.new.permission.ask.description'),
        },
        {
          value: 'auto',
          label: t('sessions.new.permission.auto.label'),
          description: t('sessions.new.permission.auto.description'),
        },
        {
          value: 'full',
          label: t('sessions.new.permission.full.label'),
          description: t('sessions.new.permission.full.description'),
        },
      ]}
    />
  );
}

import { type PermissionLevel, PermissionMenu } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/**
 * What the agent may do on the host without asking. `full` runs everything
 * unattended on a machine somebody owns (the design system gives it a warning
 * tone), so each level carries a sentence under its label: the labels alone do
 * not say what a program may do to a laptop. The copy is translated here,
 * which is why the levels are passed in: a primitive carrying English could
 * not ship in a second language.
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

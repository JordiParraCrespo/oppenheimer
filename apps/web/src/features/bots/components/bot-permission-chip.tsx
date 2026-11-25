import { PermissionMenu } from '@oppenheimer/design-system-web';
import { BOT_PERMISSIONS, type BotPermission } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';

/**
 * How far a bot's turns go without asking, the sessions' three levels: Ask
 * for approval, Approve for me (a reviewer decides) and Full access.
 */
export function BotPermissionChip({
  value,
  disabled,
  onValueChange,
}: {
  value: BotPermission;
  disabled?: boolean;
  onValueChange: (value: BotPermission) => void;
}) {
  const { t } = useTranslation();

  return (
    <PermissionMenu
      value={value}
      onValueChange={(next) => {
        const level = BOT_PERMISSIONS.find((candidate) => candidate === next);
        if (level) onValueChange(level);
      }}
      disabled={disabled}
      aria-label={t('bots.chat.permission.label')}
      options={BOT_PERMISSIONS.map((level) => ({
        value: level,
        label: t(`bots.chat.permission.${level}.label`),
        description: t(`bots.chat.permission.${level}.description`),
      }))}
    />
  );
}

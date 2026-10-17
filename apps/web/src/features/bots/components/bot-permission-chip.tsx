import { PermissionMenu } from '@oppenheimer/design-system-web';
import type { BotPermission } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';

/**
 * How far a bot's turns go without asking. Two levels until approvals arrive
 * (`product/versions/mvp/25-bots.md`, slice 4): a headless turn with no prompt
 * tool would refuse every tool, so Ask for approval is not offered yet.
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
        if (next === 'auto' || next === 'full') onValueChange(next);
      }}
      disabled={disabled}
      aria-label={t('bots.chat.permission.label')}
      options={[
        {
          value: 'auto',
          label: t('bots.chat.permission.auto.label'),
          description: t('bots.chat.permission.auto.description'),
        },
        {
          value: 'full',
          label: t('bots.chat.permission.full.label'),
          description: t('bots.chat.permission.full.description'),
        },
      ]}
    />
  );
}

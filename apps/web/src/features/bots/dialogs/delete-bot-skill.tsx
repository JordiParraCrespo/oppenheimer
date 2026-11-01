import type { BotSkillEntity } from '@oppenheimer/frontend-consumer';
import { useDeleteBotSkill } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** Delete a skill: the bot can no longer use it, and its command stops working. */
export function DeleteBotSkillDialog({
  botId,
  skill,
  onClose,
}: {
  botId: string;
  skill: BotSkillEntity;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const remove = useDeleteBotSkill({ onSuccess: onClose });

  return (
    <ConfirmDialog
      title={t('bots.settings.skills.deleteTitle', { name: skill.name })}
      description={t('bots.settings.skills.deleteBody', { name: skill.name })}
      confirmLabel={t('bots.settings.skills.delete', { name: skill.command })}
      pendingLabel={t('bots.settings.skills.deleting')}
      pending={remove.isPending}
      error={remove.error}
      errorFallback={t('bots.settings.skills.deleteFailed')}
      onClose={onClose}
      onConfirm={() => remove.mutate({ id: botId, skillId: skill.id })}
    />
  );
}

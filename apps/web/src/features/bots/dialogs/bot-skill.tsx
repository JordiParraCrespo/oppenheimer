import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import type { BotSkillEntity } from '@oppenheimer/frontend-consumer';
import { useAddBotSkill, useUpdateBotSkill } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import type { BotSkillDto } from '@oppenheimer/shared/schemas/bot-skill';
import { useTranslation } from 'react-i18next';
import { BotSkillForm } from '@/features/bots/forms/bot-skill-form';

/** Add a skill, or change one: its name, what it does, its steps and who may run it. */
export function BotSkillDialog({
  botId,
  skill,
  onClose,
}: {
  botId: string;
  /** The skill to change; none for a new one. */
  skill: BotSkillEntity | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const add = useAddBotSkill({ onSuccess: onClose });
  const update = useUpdateBotSkill({ onSuccess: onClose });
  const write = skill ? update : add;

  function save(values: BotSkillDto) {
    if (skill) update.mutate({ id: botId, skillId: skill.id, ...values });
    else add.mutate({ id: botId, ...values });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="form" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>
            {skill
              ? t('bots.settings.skills.dialog.editTitle', { name: skill.name })
              : t('bots.settings.skills.dialog.newTitle')}
          </DialogTitle>
          <DialogDescription>{t('bots.settings.skills.dialog.description')}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4 pb-7">
            <ErrorAlert
              error={write.error}
              fallback={t('bots.settings.skills.dialog.saveFailed')}
            />
            <BotSkillForm
              skill={skill}
              isPending={write.isPending}
              onSubmit={save}
              onCancel={onClose}
            />
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

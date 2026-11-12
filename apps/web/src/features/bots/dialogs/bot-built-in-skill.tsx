import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import { Markdown } from '@oppenheimer/frontend-web';
import type { BotBuiltInSkillText } from '@oppenheimer/shared/schemas/bot-skill';
import { useTranslation } from 'react-i18next';
import { skillKind } from '@/features/bots/lib/skill-row';

/** A built-in skill, read-only: what it does, who runs it and the instructions the bot follows. */
export function BotBuiltInSkillDialog({
  skill,
  onClose,
}: {
  skill: BotBuiltInSkillText;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const kind = skillKind(skill);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="form" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle className="font-mono">/{skill.name}</DialogTitle>
          <DialogDescription>{skill.description}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-3">
            <p className="m-0 text-[12.5px] text-fg-subtle">
              {kind ? `${t(`bots.settings.skills.${kind}`)} · ` : null}
              {t('bots.settings.skills.builtIn.readOnly')}
            </p>
            <h3 className="eyebrow m-0">{t('bots.settings.skills.dialog.body')}</h3>
            <div className="rounded-sm border border-border-subtle bg-card px-4 py-3 text-[13.5px] leading-[1.6]">
              <Markdown source={skill.body} />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

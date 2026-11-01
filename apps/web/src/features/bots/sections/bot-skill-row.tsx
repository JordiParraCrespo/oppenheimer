import { IconButton, SettingsListRow } from '@oppenheimer/design-system-web';
import { Pencil, X } from '@oppenheimer/design-system-web/icons';
import type { BotSkillEntity } from '@oppenheimer/frontend-consumer';
import { formatMediumDate, useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { skillRowModel } from '@/features/bots/lib/skill-row';

/**
 * One skill: its command in mono and what it does, who saved it and when, a
 * tag when only the person or only the bot runs it, then edit and delete.
 */
export function BotSkillRow({
  skill,
  onEdit,
  onDelete,
}: {
  skill: BotSkillEntity;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const row = skillRowModel(skill);

  return (
    <SettingsListRow
      meta={t(`bots.settings.skills.${row.meta}`, {
        date: formatMediumDate(skill.updatedAt, locale),
      })}
      kind={row.kind ? t(`bots.settings.skills.${row.kind}`) : undefined}
      actions={
        <>
          <IconButton
            variant="quiet"
            size="sm"
            aria-label={t('bots.settings.skills.edit', { name: skill.command })}
            onClick={onEdit}
          >
            <Pencil />
          </IconButton>
          <IconButton
            variant="quiet"
            size="sm"
            aria-label={t('bots.settings.skills.delete', { name: skill.command })}
            onClick={onDelete}
          >
            <X />
          </IconButton>
        </>
      }
    >
      <span className="font-mono">{skill.command}</span>
      <span className="text-fg-muted"> · {skill.description}</span>
    </SettingsListRow>
  );
}

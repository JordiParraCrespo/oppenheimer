import { IconButton, SettingsListRow } from '@oppenheimer/design-system-web';
import { Eye } from '@oppenheimer/design-system-web/icons';
import type { BotBuiltInSkillText } from '@oppenheimer/shared/schemas/bot-skill';
import { useTranslation } from 'react-i18next';
import { skillKind } from '@/features/bots/lib/skill-row';

/**
 * One skill Oppenheimer gives every bot: its command and what it does, a tag
 * when only one side runs it, and a view in place of edit and delete.
 */
export function BotBuiltInSkillRow({
  skill,
  onView,
}: {
  skill: BotBuiltInSkillText;
  onView: () => void;
}) {
  const { t } = useTranslation();
  const kind = skillKind(skill);

  return (
    <SettingsListRow
      meta={t('bots.settings.skills.builtIn.meta')}
      kind={kind ? t(`bots.settings.skills.${kind}`) : undefined}
      actions={
        <IconButton
          variant="quiet"
          size="sm"
          aria-label={t('bots.settings.skills.builtIn.view', { name: `/${skill.name}` })}
          onClick={onView}
        >
          <Eye />
        </IconButton>
      }
    >
      <span className="font-mono">/{skill.name}</span>
      <span className="text-fg-muted"> · {skill.description}</span>
    </SettingsListRow>
  );
}

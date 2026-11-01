import { FieldDescription } from '@oppenheimer/design-system-web';
import type { BotSkillDto } from '@oppenheimer/shared/schemas/bot-skill';
import { type Control, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/** The name field's hint, with the command it makes; it alone re-renders as the name is typed. */
export function SkillCommandHint({ control }: { control: Control<BotSkillDto> }) {
  const { t } = useTranslation();
  const name = useWatch({ control, name: 'name' });
  return (
    <FieldDescription>
      {t('bots.settings.skills.dialog.nameHint', { name: name || 'name' })}
    </FieldDescription>
  );
}

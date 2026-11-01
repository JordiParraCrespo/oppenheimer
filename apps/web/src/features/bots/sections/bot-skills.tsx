import { Button, SettingsGroup, SettingsListRow } from '@oppenheimer/design-system-web';
import type { BotSkillEntity } from '@oppenheimer/frontend-consumer';
import { useSuspenseBotSkills } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BotSkillDialog } from '@/features/bots/dialogs/bot-skill';
import { DeleteBotSkillDialog } from '@/features/bots/dialogs/delete-bot-skill';
import { BotSkillRow } from '@/features/bots/sections/bot-skill-row';

/**
 * The bot's skills by name: the count and Add skill over a card of them, each
 * row with its edit and delete. The dialogs are opened from here, since a row
 * would unmount with a rename that reorders the list.
 */
export function BotSkills({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const { data: skills, error } = useSuspenseBotSkills(botId);
  const [editing, setEditing] = useState<BotSkillEntity | 'new' | null>(null);
  const [deleting, setDeleting] = useState<BotSkillEntity | null>(null);

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3 px-1">
        <h2 className="eyebrow m-0 flex-1">
          {t('bots.settings.skills.count', { count: skills.length })}
        </h2>
        <Button variant="secondary" size="sm" onClick={() => setEditing('new')}>
          {t('bots.settings.skills.add')}
        </Button>
      </div>
      <ErrorAlert error={error} fallback={t('bots.settings.skills.loadFailed')} />
      <SettingsGroup>
        {skills.length === 0 ? (
          <SettingsListRow muted>{t('bots.settings.skills.empty')}</SettingsListRow>
        ) : (
          skills.map((skill) => (
            <BotSkillRow
              key={skill.id}
              skill={skill}
              onEdit={() => setEditing(skill)}
              onDelete={() => setDeleting(skill)}
            />
          ))
        )}
      </SettingsGroup>
      {editing ? (
        <BotSkillDialog
          botId={botId}
          skill={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <DeleteBotSkillDialog botId={botId} skill={deleting} onClose={() => setDeleting(null)} />
      ) : null}
    </section>
  );
}

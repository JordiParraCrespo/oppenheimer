import { Button, SettingsGroup, SettingsListRow } from '@oppenheimer/design-system-web';
import type { BotSkillEntity } from '@oppenheimer/frontend-consumer';
import { useSuspenseBotSkills } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import {
  BOT_BUILT_IN_SKILL_TEXTS,
  type BotBuiltInSkillText,
  builtInSkillsBeside,
} from '@oppenheimer/shared/schemas/bot-skill';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BotBuiltInSkillDialog } from '@/features/bots/dialogs/bot-built-in-skill';
import { BotSkillDialog } from '@/features/bots/dialogs/bot-skill';
import { DeleteBotSkillDialog } from '@/features/bots/dialogs/delete-bot-skill';
import { BotBuiltInSkillRow } from '@/features/bots/sections/bot-built-in-skill-row';
import { BotSkillRow } from '@/features/bots/sections/bot-skill-row';

/**
 * The bot's skills by name: the count and Add skill over a card of them, each
 * row with its edit and delete, then the ones Oppenheimer gives every bot,
 * which the person can read but not change. The dialogs are opened from
 * here, since a row would unmount with a rename that reorders the list.
 */
export function BotSkills({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const { data: skills, error } = useSuspenseBotSkills(botId);
  const [editing, setEditing] = useState<BotSkillEntity | 'new' | null>(null);
  const [deleting, setDeleting] = useState<BotSkillEntity | null>(null);
  const [viewing, setViewing] = useState<BotBuiltInSkillText | null>(null);
  const builtIns = builtInSkillsBeside(BOT_BUILT_IN_SKILL_TEXTS, skills);

  return (
    <div className="flex flex-col gap-8">
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
      </section>
      {builtIns.length > 0 ? (
        <section className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1 px-1">
            <h2 className="eyebrow m-0">
              {t('bots.settings.skills.builtIn.count', { count: builtIns.length })}
            </h2>
            <p className="m-0 text-[12.5px] text-fg-subtle">
              {t('bots.settings.skills.builtIn.hint')}
            </p>
          </div>
          <SettingsGroup>
            {builtIns.map((skill) => (
              <BotBuiltInSkillRow key={skill.name} skill={skill} onView={() => setViewing(skill)} />
            ))}
          </SettingsGroup>
        </section>
      ) : null}
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
      {viewing ? <BotBuiltInSkillDialog skill={viewing} onClose={() => setViewing(null)} /> : null}
    </div>
  );
}

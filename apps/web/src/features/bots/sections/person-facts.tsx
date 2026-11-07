import { SettingsGroup, SettingsListRow } from '@oppenheimer/design-system-web';
import { useSuspensePersonMemory } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { KeptFactRow } from './kept-fact-row';

/**
 * The facts about the person that any of their bots learned, newest first,
 * each a row that changes it on the bot that keeps it. Nothing is added
 * here: what the person wants every bot to know goes in About you.
 */
export function PersonFacts() {
  const { t } = useTranslation();
  const { data: memory, error } = useSuspensePersonMemory();

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1 px-1">
        <h2 className="eyebrow m-0">
          {t('settings.memory.learnedTitle', { count: memory.facts.length })}
        </h2>
        <p className="m-0 text-sm text-fg-subtle">{t('settings.memory.learnedHint')}</p>
      </div>
      <ErrorAlert error={error} fallback={t('settings.memory.loadFailed')} />
      <SettingsGroup>
        {memory.facts.length === 0 ? (
          <SettingsListRow muted>{t('settings.memory.learnedEmpty')}</SettingsListRow>
        ) : (
          memory.facts.map((fact) => <KeptFactRow key={fact.id} fact={fact} />)
        )}
      </SettingsGroup>
    </section>
  );
}

import {
  Button,
  SettingsAddRow,
  SettingsGroup,
  SettingsListRow,
} from '@oppenheimer/design-system-web';
import { useAddBotFact, useSuspenseBotMemory } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { BOT_MEMORY_FACT_MAX } from '@oppenheimer/shared/schemas/bot';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClearMemoryDialog } from '@/features/bots/dialogs/clear-memory';
import { BotFactRow } from './bot-fact-row';

/**
 * The bot's facts: the count and Clear all over a card of them, oldest first,
 * then the row where one is added. Each fact is a row that owns its edit and
 * its delete; this owns the add, whose draft is the add row's.
 */
export function BotMemory({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const { data: facts, error } = useSuspenseBotMemory(botId);
  const [draft, setDraft] = useState('');
  const [clearing, setClearing] = useState(false);
  const add = useAddBotFact({ onSuccess: () => setDraft('') });
  const content = draft.trim();

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3 px-1">
        <h2 className="eyebrow m-0 flex-1">
          {t('bots.settings.memory.facts', { count: facts.length })}
        </h2>
        <Button
          variant="destructive-ghost"
          size="sm"
          disabled={facts.length === 0}
          onClick={() => setClearing(true)}
        >
          {t('bots.settings.memory.clearAll')}
        </Button>
      </div>
      <ErrorAlert error={error} fallback={t('bots.settings.memory.loadFailed')} />
      <SettingsGroup>
        {facts.length === 0 ? (
          <SettingsListRow muted>{t('bots.settings.memory.empty')}</SettingsListRow>
        ) : (
          facts.map((fact) => <BotFactRow key={fact.id} botId={botId} fact={fact} />)
        )}
        <SettingsAddRow
          value={draft}
          onValueChange={(next) => setDraft(next.slice(0, BOT_MEMORY_FACT_MAX))}
          onAdd={() => add.mutate({ id: botId, content })}
          canAdd={content !== '' && !add.isPending}
          placeholder={t('bots.settings.memory.addPlaceholder')}
          addLabel={t('bots.settings.memory.add')}
          aria-label={t('bots.settings.memory.newFact')}
        />
      </SettingsGroup>
      <ErrorAlert
        error={add.error}
        fallback={t('bots.settings.memory.saveFailed')}
        onDismiss={() => add.reset()}
      />
      {clearing ? (
        <ClearMemoryDialog botId={botId} count={facts.length} onClose={() => setClearing(false)} />
      ) : null}
    </section>
  );
}

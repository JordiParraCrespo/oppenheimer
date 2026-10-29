import { Button, IconButton, Input, SettingsListRow } from '@oppenheimer/design-system-web';
import { X } from '@oppenheimer/design-system-web/icons';
import type { BotMemoryFactEntity } from '@oppenheimer/frontend-consumer';
import { useDeleteBotFact, useUpdateBotFact } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatMediumDate, useLocale } from '@oppenheimer/frontend-web';
import { BOT_MEMORY_FACT_MAX } from '@oppenheimer/shared/schemas/bot';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FactKeptMenu } from '@/features/bots/components/fact-kept-menu';

/**
 * One fact the bot remembers: the sentence, who wrote it and when, a tag when
 * it is about the person or only looked up, Edit, where it is kept, and
 * forget. Edit rewords it in place (Enter saves, Escape cancels). A fact
 * another of the person's bots shared is shown muted, to read only. The row
 * owns its writes and its draft, so editing one fact re-renders that row alone.
 */
export function BotFactRow({ botId, fact }: { botId: string; fact: BotMemoryFactEntity }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [draft, setDraft] = useState<string | null>(null);
  const update = useUpdateBotFact({ onSuccess: () => setDraft(null) });
  const remove = useDeleteBotFact();
  const when = formatMediumDate(fact.updatedAt, locale);
  const shared = fact.isSharedWith(botId);
  const kind =
    fact.scope === 'person'
      ? t('bots.settings.memory.aboutYou')
      : fact.tier === 'log'
        ? t('bots.settings.memory.lookedUp')
        : null;
  const meta = shared
    ? t('bots.settings.memory.sharedBy', { date: when })
    : fact.source === 'bot'
      ? t('bots.settings.memory.learned', { date: when })
      : fact.isEdited
        ? t('bots.settings.memory.editedByYou', { date: when })
        : t('bots.settings.memory.addedByYou', { date: when });

  function save() {
    const content = draft?.trim();
    if (!content) return;
    if (content === fact.content) setDraft(null);
    else update.mutate({ id: botId, factId: fact.id, content });
  }

  if (draft !== null) {
    return (
      <SettingsListRow>
        <span className="flex flex-col gap-2">
          <Input
            value={draft}
            maxLength={BOT_MEMORY_FACT_MAX}
            aria-label={t('bots.settings.memory.fact')}
            autoFocus
            disabled={update.isPending}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                save();
              }
              if (event.key === 'Escape') setDraft(null);
            }}
          />
          <span className="flex gap-2">
            <Button
              size="sm"
              pending={update.isPending}
              pendingLabel={t('bots.settings.memory.saving')}
              disabled={!draft.trim()}
              onClick={save}
            >
              {t('bots.settings.memory.save')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={update.isPending}
              onClick={() => {
                setDraft(null);
                update.reset();
              }}
            >
              {t('bots.settings.memory.cancel')}
            </Button>
          </span>
          <ErrorAlert error={update.error} fallback={t('bots.settings.memory.saveFailed')} />
        </span>
      </SettingsListRow>
    );
  }

  if (shared) {
    return (
      <SettingsListRow muted meta={meta} kind={kind}>
        {fact.content}
      </SettingsListRow>
    );
  }

  return (
    <>
      <SettingsListRow
        meta={meta}
        kind={kind}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDraft(fact.content)}>
              {t('bots.settings.memory.edit')}
            </Button>
            <FactKeptMenu
              fact={fact.content}
              tier={fact.tier}
              scope={fact.scope}
              disabled={update.isPending}
              onChange={(change) => update.mutate({ id: botId, factId: fact.id, ...change })}
            />
            <IconButton
              variant="quiet"
              size="sm"
              aria-label={t('bots.settings.memory.forget', { fact: fact.content })}
              disabled={remove.isPending}
              onClick={() => remove.mutate({ id: botId, factId: fact.id })}
            >
              <X />
            </IconButton>
          </>
        }
      >
        {fact.content}
      </SettingsListRow>
      <ErrorAlert
        error={update.error}
        fallback={t('bots.settings.memory.saveFailed')}
        onDismiss={() => update.reset()}
        className="mx-5 mb-3"
      />
      <ErrorAlert
        error={remove.error}
        fallback={t('bots.settings.memory.forgetFailed')}
        onDismiss={() => remove.reset()}
        className="mx-5 mb-3"
      />
    </>
  );
}

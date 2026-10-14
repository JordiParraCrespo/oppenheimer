import { SettingsGroup, SettingsRow, Switch } from '@oppenheimer/design-system-web';
import { useSuspenseBot, useUpdateBot } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * Learn automatically: whether a fact the bot decides to keep is saved without
 * asking. It applies the moment it flips, so it is a `Switch`; the bot's own
 * remembering arrives with its tools (`25-bots.md`, slice 3).
 */
export function BotLearning({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const { data: bot, error } = useSuspenseBot(botId);
  const update = useUpdateBot();
  const checked = update.isPending
    ? (update.variables.input.learnAutomatically ?? bot.learnAutomatically)
    : bot.learnAutomatically;

  return (
    <div className="flex flex-col gap-2">
      <ErrorAlert error={error} fallback={t('bots.settings.loadFailed')} />
      <SettingsGroup>
        <SettingsRow
          label={t('bots.settings.memory.learn')}
          hint={t('bots.settings.memory.learnHint')}
        >
          <Switch
            checked={checked}
            onCheckedChange={(next) =>
              update.mutate({ id: bot.id, input: { learnAutomatically: next } })
            }
            aria-label={t('bots.settings.memory.learn')}
          />
        </SettingsRow>
      </SettingsGroup>
      <ErrorAlert
        error={update.error}
        fallback={t('bots.settings.memory.learnFailed')}
        onDismiss={() => update.reset()}
      />
    </div>
  );
}

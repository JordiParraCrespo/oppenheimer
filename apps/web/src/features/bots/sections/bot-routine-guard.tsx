import { SettingsGroup, SettingsRow, Switch } from '@oppenheimer/design-system-web';
import { useSuspenseBot, useUpdateBot } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * Pause while you're away (`26-bot-routines.md` §6, the spend guard): whether
 * the bot's routines stop while its owner is away from its chat and start
 * again when they are back. On for every bot; off for one that should run
 * unattended. It applies the moment it flips, so it is a `Switch`.
 */
export function BotRoutineGuard({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const { data: bot, error } = useSuspenseBot(botId);
  const update = useUpdateBot();
  const checked = update.isPending
    ? (update.variables.input.routineSpendGuard ?? bot.routineSpendGuard)
    : bot.routineSpendGuard;

  return (
    <div className="flex flex-col gap-2">
      <ErrorAlert error={error} fallback={t('bots.settings.loadFailed')} />
      <SettingsGroup>
        <SettingsRow
          label={t('bots.settings.routines.guard')}
          hint={t('bots.settings.routines.guardHint')}
        >
          <Switch
            checked={checked}
            onCheckedChange={(next) =>
              update.mutate({ id: bot.id, input: { routineSpendGuard: next } })
            }
            aria-label={t('bots.settings.routines.guard')}
          />
        </SettingsRow>
      </SettingsGroup>
      <ErrorAlert
        error={update.error}
        fallback={t('bots.settings.routines.guardFailed')}
        onDismiss={() => update.reset()}
      />
    </div>
  );
}

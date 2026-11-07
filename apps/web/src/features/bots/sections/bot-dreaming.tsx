import { Button, SettingsGroup, SettingsRow } from '@oppenheimer/design-system-web';
import {
  useBotMemoryDream,
  useRequestBotMemoryDream,
  useUndoBotMemoryDream,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatMediumDate, useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * Tidy memory (`25-bots.md` §4.1, "Dreaming"): what the bot's last dream
 * did, Undo while it stands, and Tidy now, which queues one. A dream runs in
 * the background and says so in the chat; the chat's stream reads the memory
 * again, so this row's hint says it is under way until then.
 */
export function BotDreaming({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { data: dream, error } = useBotMemoryDream(botId);
  const request = useRequestBotMemoryDream();
  const undo = useUndoBotMemoryDream();
  const latest = dream ?? null;
  const requested = request.isSuccess && (!latest || Date.parse(latest.createdAt) < request.submittedAt);

  const hint = requested
    ? t('bots.settings.memory.dream.queued')
    : latest
      ? t(
          latest.undoneAt
            ? 'bots.settings.memory.dream.lastUndone'
            : 'bots.settings.memory.dream.last',
          {
            date: formatMediumDate(new Date(latest.createdAt), locale),
            before: latest.factsBefore,
            after: latest.factsAfter,
          },
        )
      : t('bots.settings.memory.dream.never');

  return (
    <div className="flex flex-col gap-2">
      <SettingsGroup>
        <SettingsRow label={t('bots.settings.memory.dream.title')} hint={hint}>
          <div className="flex items-center gap-2">
            {latest && !latest.undoneAt ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={undo.isPending}
                onClick={() => undo.mutate(botId)}
              >
                {t('bots.settings.memory.dream.undo')}
              </Button>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              disabled={request.isPending || requested}
              onClick={() => request.mutate(botId)}
            >
              {t('bots.settings.memory.dream.tidyNow')}
            </Button>
          </div>
        </SettingsRow>
      </SettingsGroup>
      <ErrorAlert error={error} fallback={t('bots.settings.memory.dream.loadFailed')} />
      <ErrorAlert
        error={request.error}
        fallback={t('bots.settings.memory.dream.requestFailed')}
        onDismiss={() => request.reset()}
      />
      <ErrorAlert
        error={undo.error}
        fallback={t('bots.settings.memory.dream.undoFailed')}
        onDismiss={() => undo.reset()}
      />
    </div>
  );
}

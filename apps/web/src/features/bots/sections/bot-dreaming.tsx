import { Button, SettingsGroup, SettingsRow, Skeleton } from '@oppenheimer/design-system-web';
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
 * the background and says so in the chat; while the API says it is under
 * way, this row says so. Until the state answers, the hint is a bar and
 * Tidy now waits: "never tidied" would be a guess, and a failed read says so
 * in its alert instead.
 */
export function BotDreaming({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { data: state, error } = useBotMemoryDream(botId);
  const request = useRequestBotMemoryDream();
  const undo = useUndoBotMemoryDream();
  const latest = state?.latest ?? null;
  const requested = state?.pending === true;
  const known = state !== undefined;

  const hint = !known ? (
    error ? undefined : (
      <span aria-hidden className="flex h-4.5 items-center">
        <Skeleton shape="sm" className="h-2.5 w-56" />
      </span>
    )
  ) : requested ? (
    t('bots.settings.memory.dream.queued')
  ) : latest ? (
    t(
      latest.undoneAt ? 'bots.settings.memory.dream.lastUndone' : 'bots.settings.memory.dream.last',
      {
        date: formatMediumDate(new Date(latest.createdAt), locale),
        before: latest.factsBefore,
        after: latest.factsAfter,
      },
    )
  ) : (
    t('bots.settings.memory.dream.never')
  );

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
              disabled={!known || request.isPending || requested}
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

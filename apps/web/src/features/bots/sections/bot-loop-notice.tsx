import { ComposerNotice, ComposerStackAction } from '@oppenheimer/design-system-web';
import { Repeat } from '@oppenheimer/design-system-web/icons';
import { useClearBotLoop } from '@oppenheimer/frontend-consumer/react';
import { dateFormatter, useLocale } from '@oppenheimer/frontend-web';
import type { BotLoop } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { loopCadenceOf } from '@/features/bots/lib/loop-cadence';

/**
 * The loop the bot runs (`25-bots.md` §4.1, `/loop`), fused onto the
 * composer's top edge: its prompt, how often it runs, when the next run is
 * due (or that a self-paced run has not said yet), and Stop. A Stop that
 * fails says so in the notice itself, where the button was pressed.
 */
export function BotLoopNotice({ botId, loop }: { botId: string; loop: BotLoop }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const clear = useClearBotLoop();
  const cadence = loopCadenceOf(loop.intervalMinutes);
  const time = dateFormatter(locale, { timeStyle: 'short' });
  return (
    <ComposerNotice
      icon={<Repeat />}
      action={
        <ComposerStackAction disabled={clear.isPending} onClick={() => clear.mutate({ id: botId })}>
          {t('bots.chat.loop.stop')}
        </ComposerStackAction>
      }
    >
      {clear.isError ? (
        <span className="text-danger">{t('bots.chat.loop.stopFailed')}</span>
      ) : (
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="min-w-0 truncate" title={loop.prompt}>
            {t('bots.chat.loop.title', { prompt: loop.prompt })}
          </span>
          <span className="shrink-0 text-xs text-fg-muted">
            {t(cadence.key, { count: cadence.count })} ·{' '}
            {loop.nextRunAt
              ? t('bots.chat.loop.next', { time: time.format(new Date(loop.nextRunAt)) })
              : t('bots.chat.loop.deciding')}
          </span>
        </span>
      )}
    </ComposerNotice>
  );
}

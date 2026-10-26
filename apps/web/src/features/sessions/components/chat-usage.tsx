import {
  Button,
  ComposerContextMeter,
  Popover,
  PopoverContent,
  PopoverTrigger,
  StatBar,
} from '@oppenheimer/design-system-web';
import type { ChatLimit } from '@oppenheimer/frontend-consumer';
import { dateFormatter, useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { type ChatContext, formatTokens } from '../lib/chat-blocks';

/** A share at which a bar takes the warning tone, as the CLI's own warning does. */
const WARN_AT = 80;

/**
 * How much room the agent has, beside the model on the composer: the
 * context meter, which opens to the context in tokens (with Compact) and the
 * plan's usage limits, the 5-hour and the weekly window, each with when it
 * resets. The limits come from Claude Code's status line on the host; an
 * account on an API key has none, and the popover says only the context.
 */
export function ChatUsage({
  context,
  fiveHour,
  sevenDay,
  onCompact,
}: {
  context: ChatContext | null;
  fiveHour: ChatLimit | null;
  sevenDay: ChatLimit | null;
  onCompact: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const shown = context?.percent ?? fiveHour?.usedPercent ?? sevenDay?.usedPercent ?? 0;
  const hour = dateFormatter(locale, { timeStyle: 'short' });
  const day = dateFormatter(locale, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  const limits = [
    { key: 'fiveHour', limit: fiveHour, when: hour },
    { key: 'sevenDay', limit: sevenDay, when: day },
  ] as const;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <ComposerContextMeter
            value={shown}
            label={t('sessions.chat.usage.open', { percent: Math.round(shown) })}
          />
        }
      />
      <PopoverContent side="top" align="end" className="gap-4">
        {context ? (
          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{t('sessions.chat.usage.context')}</span>
              <span className="figures font-mono text-[12px] text-fg-muted">
                {Math.round(context.percent)}%
              </span>
            </div>
            <StatBar track segments={[{ share: context.percent, tone: tone(context.percent) }]} />
            <div className="flex items-center justify-between gap-3 text-[12.5px] text-fg-muted">
              <span className="figures font-mono">
                {t('sessions.chat.usage.tokens', {
                  used: formatTokens(context.tokens, locale),
                  window: formatTokens(context.window, locale),
                })}
              </span>
              <Button variant="ghost" size="sm" onClick={onCompact}>
                {t('sessions.chat.usage.compact')}
              </Button>
            </div>
          </section>
        ) : null}
        {fiveHour || sevenDay ? (
          <section className="flex flex-col gap-3">
            <span className="font-medium">{t('sessions.chat.usage.plan')}</span>
            {limits.map(({ key, limit, when }) =>
              limit ? (
                <div key={key} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span>{t(`sessions.chat.usage.${key}`)}</span>
                    <span className="flex items-baseline gap-2 text-fg-muted">
                      {limit.resetsAt ? (
                        <span className="text-[12.5px]">
                          {t('sessions.chat.usage.resets', { when: when.format(limit.resetsAt) })}
                        </span>
                      ) : null}
                      <span className="figures font-mono text-[12px]">
                        {Math.round(limit.usedPercent)}%
                      </span>
                    </span>
                  </div>
                  <StatBar
                    track
                    segments={[{ share: limit.usedPercent, tone: tone(limit.usedPercent) }]}
                  />
                </div>
              ) : null,
            )}
          </section>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function tone(percent: number) {
  return percent >= WARN_AT ? 'warning' : 'muted';
}

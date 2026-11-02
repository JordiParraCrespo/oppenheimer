import {
  Button,
  ComposerContextMeter,
  Popover,
  PopoverContent,
  PopoverTrigger,
  StatBar,
} from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { dateFormatter, useLocale } from '../../i18n';
import { type ChatUsageContext, type ChatUsageLimit, contextPercent } from '../lib/chat-usage';
import { formatTokens } from '../lib/format-tokens';

/** A share at which a bar takes the warning tone, as Claude Code's own warning does. */
const WARN_AT = 80;

/**
 * How much room an agent has, beside the model on a chat's composer: the
 * context meter, which opens to the context in tokens and the plan's usage
 * limits, the 5-hour and the weekly window, each with when it resets. Each
 * part shows when the caller has it: an agent on an API key has no plan
 * windows, and one whose window is unknown shows its context in tokens
 * alone. The meter reads the context's share, or, with no window, the
 * 5-hour window's. With nothing to read, it draws nothing. `onCompact`, when
 * the agent can be asked to, adds Compact to the context.
 */
export function ChatUsage({
  context,
  fiveHour,
  sevenDay,
  onCompact,
}: {
  context: ChatUsageContext | null;
  fiveHour: ChatUsageLimit | null;
  sevenDay: ChatUsageLimit | null;
  onCompact?: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const percent = contextPercent(context);
  const shown = percent ?? fiveHour?.usedPercent ?? sevenDay?.usedPercent;
  if (shown === undefined) return null;
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
            label={t(percent === null ? 'common.chat.usage.openPlan' : 'common.chat.usage.open', {
              percent: Math.round(shown),
            })}
          />
        }
      />
      <PopoverContent side="top" align="end" className="gap-4">
        {context ? (
          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{t('common.chat.usage.context')}</span>
              {percent !== null ? (
                <span className="figures font-mono text-[12px] text-fg-muted">
                  {Math.round(percent)}%
                </span>
              ) : null}
            </div>
            {percent !== null ? (
              <StatBar track segments={[{ share: percent, tone: tone(percent) }]} />
            ) : null}
            <div className="flex items-center justify-between gap-3 text-[12.5px] text-fg-muted">
              <span className="figures font-mono">
                {context.window
                  ? t('common.chat.usage.tokens', {
                      used: formatTokens(context.tokens, locale),
                      window: formatTokens(context.window, locale),
                    })
                  : t('common.chat.usage.tokensOnly', {
                      used: formatTokens(context.tokens, locale),
                    })}
              </span>
              {onCompact ? (
                <Button variant="ghost" size="sm" onClick={onCompact}>
                  {t('common.chat.usage.compact')}
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}
        {fiveHour || sevenDay ? (
          <section className="flex flex-col gap-3">
            <span className="font-medium">{t('common.chat.usage.plan')}</span>
            {limits.map(({ key, limit, when }) =>
              limit ? (
                <div key={key} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span>{t(`common.chat.usage.${key}`)}</span>
                    <span className="flex items-baseline gap-2 text-fg-muted">
                      {limit.resetsAt ? (
                        <span className="text-[12.5px]">
                          {t('common.chat.usage.resets', { when: when.format(limit.resetsAt) })}
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

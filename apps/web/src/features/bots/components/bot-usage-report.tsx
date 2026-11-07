import { IconButton, StatBar } from '@oppenheimer/design-system-web';
import { X } from '@oppenheimer/design-system-web/icons';
import {
  type ChatUsageLimit,
  dateFormatter,
  formatTimeAway,
  formatTokens,
  useLocale,
} from '@oppenheimer/frontend-web';
import { type BotUsage, botModelOf } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { CopyTextButton } from '@/features/bots/components/copy-text-button';
import { botUsageTotals, modelShares, uncachedInput } from '@/features/bots/lib/bot-usage';

/** A share at which a plan bar takes the warning tone, as the composer's meter does. */
const WARN_AT = 80;

/** A figure's cell or a breakdown's line: a rule under each, so the rows read as a table. */
const ROW = 'flex items-baseline gap-2 border-b border-border-subtle py-1';

const PURPOSE_KEYS = {
  goal_review: 'bots.chat.usage.purpose.goalReview',
  summary: 'bots.chat.usage.purpose.summary',
  rule_review: 'bots.chat.usage.purpose.ruleReview',
  dream: 'bots.chat.usage.purpose.dream',
} as const;

/**
 * What a bot's chat has spent, as a small card in the chat (`25-bots.md`
 * §4.1, `/usage`; drawn after Claude Code's usage card): the plan's windows
 * on a sign-in, this chat's figures in a grid (time at work, turns, cache
 * hit rate, tokens, each model's share), and the breakdown of every token
 * into fresh input, output and cache reads and writes, the calls outside its
 * turns included and named under it. Copy puts it on the clipboard; Close
 * takes the card away. No money: nothing here knows a model's prices.
 */
export function BotUsageReport({
  usage,
  fiveHour,
  sevenDay,
  onClose,
}: {
  usage: BotUsage;
  fiveHour: ChatUsageLimit | null;
  sevenDay: ChatUsageLimit | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const totals = botUsageTotals(usage);
  const tokens = (count: number) => formatTokens(count, locale);
  const label = (model: BotUsage['models'][number]) =>
    botModelOf(model.provider, model.model)?.label ?? model.model;
  const windows = [
    {
      key: 'fiveHour',
      limit: fiveHour,
      when: dateFormatter(locale, { timeStyle: 'short' }),
    },
    {
      key: 'sevenDay',
      limit: sevenDay,
      when: dateFormatter(locale, { weekday: 'short', hour: 'numeric', minute: '2-digit' }),
    },
  ] as const;
  const figures = [
    { label: t('bots.chat.usage.active'), value: formatTimeAway(usage.activeMs, locale) },
    { label: t('bots.chat.usage.turns'), value: String(usage.turns) },
    {
      label: t('bots.chat.usage.cacheHit'),
      value: totals.cacheHitPercent === null ? '—' : `${totals.cacheHitPercent}%`,
    },
    { label: t('bots.chat.usage.tokens'), value: tokens(totals.tokens) },
    ...modelShares(usage).map((share, index) => ({
      label: usage.models[index] ? label(usage.models[index]) : share.model,
      value: `${share.percent}%`,
    })),
  ];
  const breakdown = [
    { label: t('bots.chat.usage.input'), value: uncachedInput(totals) },
    { label: t('bots.chat.usage.output'), value: totals.outputTokens },
    { label: t('bots.chat.usage.cacheRead'), value: totals.cacheReadTokens },
    { label: t('bots.chat.usage.cacheWrite'), value: totals.cacheWriteTokens },
  ];
  const models =
    usage.models.length === 1 && usage.models[0]
      ? label(usage.models[0])
      : t('bots.chat.usage.models', { count: usage.models.length });
  const outside = usage.background
    .map((row) => t(PURPOSE_KEYS[row.purpose], { count: row.calls }))
    .join(', ');
  const copyText = [
    t('bots.chat.usage.title'),
    ...figures.map((figure) => `${figure.label} ${figure.value}`),
    ...breakdown.map((row) => `${row.label} ${tokens(row.value)}`),
    ...(outside ? [t('bots.chat.usage.includes', { calls: outside })] : []),
  ].join('\n');

  return (
    <div className="flex flex-col gap-3 text-[12px]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium">{t('bots.chat.usage.title')}</h3>
        <span className="flex items-center gap-1">
          {usage.turns > 0 ? (
            <CopyTextButton text={copyText} label={t('bots.chat.usage.copy')} />
          ) : null}
          <IconButton size="xs" shape="square" aria-label={t('common.close')} onClick={onClose}>
            <X aria-hidden />
          </IconButton>
        </span>
      </div>
      {windows.map(({ key, limit, when }) =>
        limit ? (
          <div key={key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-fg-muted">
              <span>{t(`common.chat.usage.${key}`)}</span>
              <span className="flex items-baseline gap-2">
                {limit.resetsAt ? (
                  <span>
                    {t('common.chat.usage.resets', { when: when.format(limit.resetsAt) })}
                  </span>
                ) : null}
                <span className="figures text-fg">{Math.round(limit.usedPercent)}%</span>
              </span>
            </div>
            <StatBar
              className="h-1"
              track
              segments={[
                {
                  share: limit.usedPercent,
                  tone: limit.usedPercent >= WARN_AT ? 'warning' : 'muted',
                },
              ]}
            />
          </div>
        ) : null,
      )}
      {usage.turns === 0 ? (
        <p className="text-fg-muted">{t('bots.chat.usage.empty')}</p>
      ) : (
        <>
          <section className="flex flex-col">
            <h4 className="pb-0.5 font-medium">{t('bots.chat.usage.thisChat')}</h4>
            <dl className="grid grid-cols-[repeat(3,auto)]">
              {figures.map((figure) => (
                <div key={figure.label} className={`${ROW} min-w-0 pr-3 text-fg-muted`}>
                  <dt className="truncate">{figure.label}</dt>
                  <dd className="figures shrink-0">{figure.value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="flex flex-col">
            <div className="flex items-baseline justify-between gap-3 pb-0.5">
              <h4 className="font-medium">{t('bots.chat.usage.breakdown')}</h4>
              <span className="truncate text-fg-muted">{models}</span>
            </div>
            {breakdown.map((row) => (
              <div key={row.label} className={`${ROW} justify-between text-fg-muted`}>
                <span>{row.label}</span>
                <span className="figures">{tokens(row.value)}</span>
              </div>
            ))}
            {outside ? (
              <p className="pt-1.5 text-[11px] text-fg-muted">
                {t('bots.chat.usage.includes', { calls: outside })}
              </p>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}

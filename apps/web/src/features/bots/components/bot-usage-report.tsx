import { IconButton } from '@oppenheimer/design-system-web';
import { X } from '@oppenheimer/design-system-web/icons';
import {
  type ChatUsageContext,
  ChatUsageDetails,
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

/** A figure's cell, or a breakdown's line: label muted, number on the right, a rule under it. */
const LINE =
  'flex items-baseline justify-between gap-3 border-b border-border-subtle py-2 text-[13px]';

const PURPOSE_KEYS = {
  goal_review: 'bots.chat.usage.purpose.goalReview',
  summary: 'bots.chat.usage.purpose.summary',
  rule_review: 'bots.chat.usage.purpose.ruleReview',
} as const;

/**
 * What a bot's chat has spent, in the chat (`25-bots.md` §4.1, `/usage`;
 * after Claude Code's usage card): the room it has left (context, plan
 * windows), this chat's figures and each model's share, and one breakdown
 * of every token it spent, its calls outside its turns included and named
 * under it. Copy puts the figures on the clipboard; Close takes the card
 * away. No money: nothing here knows a model's prices.
 */
export function BotUsageReport({
  usage,
  context,
  fiveHour,
  sevenDay,
  onClose,
}: {
  usage: BotUsage;
  context: ChatUsageContext | null;
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
  const since = usage.since
    ? dateFormatter(locale, { dateStyle: 'medium' }).format(new Date(usage.since))
    : null;
  const figures = [
    { label: t('bots.chat.usage.turns'), value: String(usage.turns) },
    { label: t('bots.chat.usage.active'), value: formatTimeAway(usage.activeMs, locale) },
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
  const outside = usage.background
    .map((row) => t(PURPOSE_KEYS[row.purpose], { count: row.calls }))
    .join(', ');
  const models =
    usage.models.length === 1 && usage.models[0]
      ? label(usage.models[0])
      : t('bots.chat.usage.models', { count: usage.models.length });
  const copyText = [
    t('bots.chat.usage.title'),
    ...figures.map((figure) => `${figure.label}: ${figure.value}`),
    ...breakdown.map((row) => `${row.label}: ${tokens(row.value)}`),
    ...(outside ? [t('bots.chat.usage.includes', { calls: outside })] : []),
  ].join('\n');

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium">{t('bots.chat.usage.title')}</h3>
        <span className="flex items-center gap-1">
          <CopyTextButton text={copyText} label={t('bots.chat.usage.copy')} />
          <IconButton size="xs" shape="square" aria-label={t('common.close')} onClick={onClose}>
            <X aria-hidden />
          </IconButton>
        </span>
      </div>
      <ChatUsageDetails context={context} fiveHour={fiveHour} sevenDay={sevenDay} />
      {usage.turns === 0 ? (
        <p className="text-[13px] text-fg-muted">{t('bots.chat.usage.empty')}</p>
      ) : (
        <>
          <section className="flex flex-col">
            <h4 className="pb-1 font-medium">
              {t('bots.chat.usage.thisChat')}
              {since ? (
                <span className="ml-2 text-[12.5px] font-normal text-fg-muted">
                  {t('bots.chat.usage.since', { date: since })}
                </span>
              ) : null}
            </h4>
            <dl className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">
              {figures.map((figure) => (
                <div key={figure.label} className={LINE}>
                  <dt className="truncate text-fg-muted">{figure.label}</dt>
                  <dd className="figures shrink-0 font-mono">{figure.value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="flex flex-col">
            <div className="flex items-baseline justify-between gap-3 pb-1">
              <h4 className="font-medium">{t('bots.chat.usage.breakdown')}</h4>
              <span className="text-[13px] text-fg-muted">{models}</span>
            </div>
            {breakdown.map((row) => (
              <div key={row.label} className={LINE}>
                <span className="text-fg-muted">{row.label}</span>
                <span className="figures font-mono">{tokens(row.value)}</span>
              </div>
            ))}
            {outside ? (
              <p className="pt-2 text-[12.5px] text-fg-muted">
                {t('bots.chat.usage.includes', { calls: outside })}
              </p>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}

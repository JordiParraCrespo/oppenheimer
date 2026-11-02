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

/** A figure's line: its label muted on the left, the number on the right, a rule under it. */
const ROW =
  'flex items-baseline justify-between gap-3 border-b border-border-subtle py-2 text-[13px]';

const PURPOSE_KEYS = {
  goal_review: 'bots.chat.usage.purpose.goalReview',
  summary: 'bots.chat.usage.purpose.summary',
  rule_review: 'bots.chat.usage.purpose.ruleReview',
} as const;

/**
 * What a bot's chat has spent (`25-bots.md` §4.1, `/usage`; drawn after
 * Claude Code's usage card): the room it has left (context, plan windows),
 * then this chat (turns, time at work, tokens, cache hits, each model's
 * share), each model's breakdown of input, output and cache, and what it
 * spent outside its turns. Copy puts the same figures on the clipboard as
 * text. No money is shown: nothing here knows a model's prices.
 */
export function BotUsageReport({
  usage,
  context,
  fiveHour,
  sevenDay,
}: {
  usage: BotUsage;
  context: ChatUsageContext | null;
  fiveHour: ChatUsageLimit | null;
  sevenDay: ChatUsageLimit | null;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const totals = botUsageTotals(usage);
  const tokens = (count: number) => formatTokens(count, locale);
  const modelLabel = (provider: BotUsage['models'][number]['provider'], model: string) =>
    botModelOf(provider, model)?.label ?? model;
  const since = usage.since
    ? dateFormatter(locale, { dateStyle: 'medium' }).format(new Date(usage.since))
    : null;
  const shares = modelShares(usage).map(
    ({ model, percent }, index) =>
      `${modelLabel(usage.models[index]?.provider ?? 'anthropic', model)} ${percent}%`,
  );
  const stats = [
    { label: t('bots.chat.usage.turns'), value: String(usage.turns) },
    { label: t('bots.chat.usage.active'), value: formatTimeAway(usage.activeMs, locale) },
    { label: t('bots.chat.usage.tokens'), value: tokens(totals.tokens) },
    {
      label: t('bots.chat.usage.cacheHit'),
      value: totals.cacheHitPercent === null ? '—' : `${totals.cacheHitPercent}%`,
    },
  ];
  const copyText = [
    `${t('bots.chat.usage.thisChat')}${since ? ` (${t('bots.chat.usage.since', { date: since })})` : ''}`,
    ...stats.map((stat) => `${stat.label}: ${stat.value}`),
    ...usage.models.map(
      (model) =>
        `${modelLabel(model.provider, model.model)}: ${t('bots.chat.usage.input')} ${tokens(uncachedInput(model))}, ${t('bots.chat.usage.output')} ${tokens(model.outputTokens)}, ${t('bots.chat.usage.cacheRead')} ${tokens(model.cacheReadTokens)}, ${t('bots.chat.usage.cacheWrite')} ${tokens(model.cacheWriteTokens)}`,
    ),
    ...usage.background.map(
      (row) =>
        `${t(PURPOSE_KEYS[row.purpose])}: ${t('bots.chat.usage.calls', { count: row.calls })}, ${tokens(row.inputTokens + row.outputTokens)}`,
    ),
  ].join('\n');

  return (
    <div className="flex flex-col gap-6">
      <ChatUsageDetails context={context} fiveHour={fiveHour} sevenDay={sevenDay} />
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium">
            {t('bots.chat.usage.thisChat')}
            {since ? (
              <span className="ml-2 text-[12.5px] font-normal text-fg-muted">
                {t('bots.chat.usage.since', { date: since })}
              </span>
            ) : null}
          </h3>
          <CopyTextButton text={copyText} label={t('bots.chat.usage.copy')} />
        </div>
        {usage.turns === 0 ? (
          <p className="text-[13px] text-fg-muted">{t('bots.chat.usage.empty')}</p>
        ) : (
          <dl className="grid grid-cols-2 gap-x-6 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className={ROW}>
                <dt className="text-fg-muted">{stat.label}</dt>
                <dd className="figures font-mono">{stat.value}</dd>
              </div>
            ))}
            {shares.length > 0 ? (
              <div className="col-span-full border-b border-border-subtle py-2 text-[13px] text-fg-muted">
                {shares.join(' · ')}
              </div>
            ) : null}
          </dl>
        )}
      </section>
      {usage.models.map((model) => (
        <section key={`${model.provider}:${model.model}`} className="flex flex-col">
          <div className="flex items-baseline justify-between gap-3 pb-1">
            <h3 className="font-medium">{t('bots.chat.usage.breakdown')}</h3>
            <span className="text-[13px] text-fg-muted">
              {modelLabel(model.provider, model.model)}
            </span>
          </div>
          {[
            { label: t('bots.chat.usage.input'), value: uncachedInput(model) },
            { label: t('bots.chat.usage.output'), value: model.outputTokens },
            { label: t('bots.chat.usage.cacheRead'), value: model.cacheReadTokens },
            { label: t('bots.chat.usage.cacheWrite'), value: model.cacheWriteTokens },
          ].map((row) => (
            <div key={row.label} className={ROW}>
              <span className="text-fg-muted">{row.label}</span>
              <span className="figures font-mono">{tokens(row.value)}</span>
            </div>
          ))}
        </section>
      ))}
      {usage.background.length > 0 ? (
        <section className="flex flex-col">
          <h3 className="pb-1 font-medium">{t('bots.chat.usage.outside')}</h3>
          {usage.background.map((row) => (
            <div key={row.purpose} className={ROW}>
              <span className="text-fg-muted">
                {t(PURPOSE_KEYS[row.purpose])} · {t('bots.chat.usage.calls', { count: row.calls })}
              </span>
              <span className="figures font-mono">
                {tokens(row.inputTokens + row.outputTokens)}
              </span>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

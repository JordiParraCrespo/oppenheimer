import { IconButton } from '@oppenheimer/design-system-web';
import { X } from '@oppenheimer/design-system-web/icons';
import { dateFormatter, formatTimeAway, formatTokens, useLocale } from '@oppenheimer/frontend-web';
import { type BotUsage, botModelOf } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { CopyTextButton } from '@/features/bots/components/copy-text-button';
import { botUsageTotals, modelShares, uncachedInput } from '@/features/bots/lib/bot-usage';

const PURPOSE_KEYS = {
  goal_review: 'bots.chat.usage.purpose.goalReview',
  summary: 'bots.chat.usage.purpose.summary',
  rule_review: 'bots.chat.usage.purpose.ruleReview',
} as const;

/**
 * What a bot's chat has spent, in the chat (`25-bots.md` §4.1, `/usage`), in
 * three lines: its turns, time at work, tokens and cache hit rate; the
 * tokens split into fresh input, output, cache reads and writes; and each
 * model's share, with the calls outside its turns the totals include. The
 * context and plan windows are the composer's meter, not repeated here.
 * Copy puts the lines on the clipboard; Close takes the card away. No money:
 * nothing here knows a model's prices.
 */
export function BotUsageReport({ usage, onClose }: { usage: BotUsage; onClose: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const totals = botUsageTotals(usage);
  const tokens = (count: number) => formatTokens(count, locale);
  const since = usage.since
    ? dateFormatter(locale, { dateStyle: 'medium' }).format(new Date(usage.since))
    : null;
  const summary = t('bots.chat.usage.summary', {
    count: usage.turns,
    active: formatTimeAway(usage.activeMs, locale),
    tokens: tokens(totals.tokens),
  });
  const cache =
    totals.cacheHitPercent === null
      ? null
      : t('bots.chat.usage.cacheHit', { percent: totals.cacheHitPercent });
  const split = [
    t('bots.chat.usage.input', { tokens: tokens(uncachedInput(totals)) }),
    t('bots.chat.usage.output', { tokens: tokens(totals.outputTokens) }),
    t('bots.chat.usage.cacheRead', { tokens: tokens(totals.cacheReadTokens) }),
    t('bots.chat.usage.cacheWrite', { tokens: tokens(totals.cacheWriteTokens) }),
  ].join(' · ');
  const models = modelShares(usage)
    .map(({ percent }, index) => {
      const model = usage.models[index];
      return model
        ? t('bots.chat.usage.modelShare', {
            model: botModelOf(model.provider, model.model)?.label ?? model.model,
            percent,
          })
        : '';
    })
    .filter(Boolean)
    .join(' · ');
  const outside = usage.background
    .map((row) => t(PURPOSE_KEYS[row.purpose], { count: row.calls }))
    .join(', ');
  const lines = [
    [summary, cache].filter(Boolean).join(' · '),
    split,
    [models, outside ? t('bots.chat.usage.includes', { calls: outside }) : null]
      .filter(Boolean)
      .join(' — '),
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-1.5 text-[13px]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium">
          {t('bots.chat.usage.title')}
          {since ? (
            <span className="ml-2 font-normal text-fg-muted">
              {t('bots.chat.usage.since', { date: since })}
            </span>
          ) : null}
        </h3>
        <span className="flex items-center gap-1">
          {usage.turns > 0 ? (
            <CopyTextButton text={lines.join('\n')} label={t('bots.chat.usage.copy')} />
          ) : null}
          <IconButton size="xs" shape="square" aria-label={t('common.close')} onClick={onClose}>
            <X aria-hidden />
          </IconButton>
        </span>
      </div>
      {usage.turns === 0 ? (
        <p className="text-fg-muted">{t('bots.chat.usage.empty')}</p>
      ) : (
        lines.map((line, index) => (
          <p key={line} className={index === 0 ? 'figures' : 'figures text-fg-muted'}>
            {line}
          </p>
        ))
      )}
    </div>
  );
}

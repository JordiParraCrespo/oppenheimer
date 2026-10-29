import { ChatErrorAction, ChatErrorBanner } from '@oppenheimer/design-system-web';
import { KeyRound, RotateCcw } from '@oppenheimer/design-system-web/icons';
import type { BotTurnEntity } from '@oppenheimer/frontend-consumer';
import { BOT_PROVIDER_CATALOG, BOT_TURN_FAILURE_RETRIES } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';

/**
 * Why a turn failed, and what helps (`25-bots.md` §2, from Grok Bot's failure
 * lines): the title says what happened and whether sending it again can
 * succeed, the details keep the provider's own words. Retry is offered only
 * when it can help; a refused key or sign-in points at Model providers
 * instead, where it is fixed.
 */
export function BotTurnFailure({
  turn,
  onRetry,
  retrying,
  onOpenProviders,
}: {
  turn: BotTurnEntity;
  onRetry?: () => void;
  retrying: boolean;
  onOpenProviders?: () => void;
}) {
  const { t } = useTranslation();
  const failure = turn.failure ?? 'other';
  const provider = BOT_PROVIDER_CATALOG[turn.provider].label;
  const title =
    failure === 'other'
      ? t('bots.chat.failed', { provider })
      : t(`bots.chat.failure.${failure}`, { provider });
  const retryHelps = BOT_TURN_FAILURE_RETRIES[failure];
  return (
    <ChatErrorBanner
      title={title}
      actions={
        <>
          {failure === 'credential' && onOpenProviders ? (
            <ChatErrorAction onClick={onOpenProviders}>
              <KeyRound aria-hidden />
              {t('bots.chat.openProviders')}
            </ChatErrorAction>
          ) : null}
          {onRetry && retryHelps ? (
            <ChatErrorAction onClick={onRetry} disabled={retrying}>
              <RotateCcw aria-hidden />
              {t('bots.chat.retry')}
            </ChatErrorAction>
          ) : null}
        </>
      }
      labels={{ details: t('bots.chat.errorDetails'), less: t('bots.chat.errorLess') }}
    >
      {turn.error ?? t('bots.chat.failedUnknown')}
    </ChatErrorBanner>
  );
}

import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotGatewaysSkeleton } from '@/features/bots/components/bot-gateways-skeleton';
import { BotTelegramGateways } from '@/features/bots/sections/bot-telegram-gateways';

/** The Telegram bots this bot answers on. */
export function BotTelegramPanel({ botId }: { botId: string }) {
  const { t } = useTranslation();
  return (
    <QueryState>
      <QueryState.Pending>
        <BotGatewaysSkeleton />
      </QueryState.Pending>
      <QueryState.Error fallback={t('bots.settings.gateways.telegramFailed')} />
      <QueryState.Data>
        <BotTelegramGateways botId={botId} />
      </QueryState.Data>
    </QueryState>
  );
}

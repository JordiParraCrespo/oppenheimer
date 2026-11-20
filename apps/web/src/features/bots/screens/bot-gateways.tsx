import { SettingsTitle } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotGatewaysSkeleton } from '@/features/bots/components/bot-gateways-skeleton';
import { BotTelegramGateways } from '@/features/bots/sections/bot-telegram-gateways';
import { BotWhatsappGateways } from '@/features/bots/sections/bot-whatsapp-gateways';

/**
 * `/bots/$botId/settings/gateways`: where people reach the bot. Each WhatsApp
 * number with the groups and people this bot answers there, and the
 * Telegram bots it answers on, each read on its own.
 */
export function BotGatewaysScreen({ botId }: { botId: string }) {
  const { t } = useTranslation();

  return (
    <>
      <SettingsTitle
        title={t('bots.settings.gateways.title')}
        description={t('bots.settings.gateways.subtitle')}
      />
      <div className="flex flex-col gap-6">
        <QueryState>
          <QueryState.Pending>
            <BotGatewaysSkeleton />
          </QueryState.Pending>
          <QueryState.Error fallback={t('bots.settings.gateways.whatsappFailed')} />
          <QueryState.Data>
            <BotWhatsappGateways botId={botId} />
          </QueryState.Data>
        </QueryState>
        <QueryState>
          <QueryState.Pending>
            <BotGatewaysSkeleton />
          </QueryState.Pending>
          <QueryState.Error fallback={t('bots.settings.gateways.telegramFailed')} />
          <QueryState.Data>
            <BotTelegramGateways botId={botId} />
          </QueryState.Data>
        </QueryState>
      </div>
    </>
  );
}
